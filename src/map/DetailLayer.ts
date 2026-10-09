// MapLibre 사용자 정의 레이어: OSM 상세 건물 + 가로수를 three.js로 그립니다.
import * as THREE from 'three';
import maplibregl, { type CustomLayerInterface, type CustomRenderMethodInput, type Map as MLMap } from 'maplibre-gl';
import type { DayDetail, DetailTree, TreeKind } from '../lib/detailTypes';
import { buildBuildings, createBuildingMaterial, FLIP_WINDING } from './buildMeshes';

export const DETAIL_LAYER_ID = 'osm-detail-3d';
const MAX_TREES = 2200;

interface TreeInst {
  x: number;
  y: number;
  t: DetailTree;
}

export class DetailLayer implements CustomLayerInterface {
  id = DETAIL_LAYER_ID;
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map?: MLMap;
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private root = new THREE.Group();
  private origin = new maplibregl.MercatorCoordinate(0, 0, 0);
  private scale = 1;
  private buildingMesh?: THREE.Mesh;
  private buildingMaterial = createBuildingMaterial();
  private trees: TreeInst[] = [];
  private treeMeshes: THREE.InstancedMesh[] = [];
  private focus: [number, number] | null = null;
  private visible = true;
  stats = { triangles: 0, trees: 0, treesTotal: 0 };

  constructor() {
    this.scene.add(this.root);
    // 빛: 남동쪽 위에서 비추는 해 + 하늘·지면 반사광
    const hemi = new THREE.HemisphereLight(0xf2f4ef, 0x8b8a80, 1.55);
    hemi.position.set(0, 0, 1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e2, 1.35);
    sun.position.set(0.55, 0.65, 1.0); // y=남쪽
    this.scene.add(sun);
  }

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  onRemove() {
    this.clear();
    this.renderer?.dispose();
    this.renderer = undefined;
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.map?.triggerRepaint();
  }

  clear() {
    if (this.buildingMesh) {
      this.root.remove(this.buildingMesh);
      this.buildingMesh.geometry.dispose();
      this.buildingMesh = undefined;
    }
    for (const m of this.treeMeshes) {
      this.root.remove(m);
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    }
    this.treeMeshes = [];
    this.trees = [];
    this.stats = { triangles: 0, trees: 0, treesTotal: 0 };
    this.map?.triggerRepaint();
  }

  setData(data: DayDetail | null) {
    this.clear();
    if (!data) return;
    this.origin = maplibregl.MercatorCoordinate.fromLngLat({ lng: data.origin[0], lat: data.origin[1] }, 0);
    this.scale = this.origin.meterInMercatorCoordinateUnits();
    const project = (lng: number, lat: number): [number, number] => {
      const m = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat }, 0);
      return [(m.x - this.origin.x) / this.scale, (m.y - this.origin.y) / this.scale];
    };

    const { geometry, triangles } = buildBuildings(data.buildings, project);
    this.buildingMaterial.side = THREE.FrontSide;
    this.buildingMesh = new THREE.Mesh(geometry, this.buildingMaterial);
    this.buildingMesh.frustumCulled = false;
    this.root.add(this.buildingMesh);

    this.trees = data.trees.map((t) => {
      const [x, y] = project(t.p[0], t.p[1]);
      return { x, y, t };
    });
    this.treeMeshes = createTreeMeshes(Math.min(MAX_TREES, this.trees.length));
    this.treeMeshes.forEach((m) => this.root.add(m));
    this.stats = { triangles, trees: 0, treesTotal: this.trees.length };
    this.layoutTrees();
  }

  /** 선택 장소에서 가까운 나무부터 표시합니다. */
  setFocus(lng: number, lat: number) {
    this.focus = [lng, lat];
    this.layoutTrees();
  }

  private layoutTrees() {
    if (!this.treeMeshes.length) return;
    let list = this.trees;
    if (this.focus && list.length > MAX_TREES) {
      const m = maplibregl.MercatorCoordinate.fromLngLat({ lng: this.focus[0], lat: this.focus[1] }, 0);
      const fx = (m.x - this.origin.x) / this.scale;
      const fy = (m.y - this.origin.y) / this.scale;
      list = [...list]
        .sort((a, b) => (a.x - fx) ** 2 + (a.y - fy) ** 2 - ((b.x - fx) ** 2 + (b.y - fy) ** 2))
        .slice(0, MAX_TREES);
    } else list = list.slice(0, MAX_TREES);

    const [trunks, broad, needle, palm, shadows] = this.treeMeshes;
    const counts: Record<TreeKind, number> = { broad: 0, needle: 0, palm: 0 };
    const crownMesh: Record<TreeKind, THREE.InstancedMesh> = { broad, needle, palm };
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    const greens: Record<TreeKind, [number, number, number]> = {
      broad: [0.27, 0.42, 0.34],
      needle: [0.29, 0.39, 0.29],
      palm: [0.24, 0.45, 0.42],
    };

    list.forEach((it, i) => {
      const { t } = it;
      const rnd = hash(it.x * 13.1 + it.y * 7.7);
      const trunkH = t.kind === 'palm' ? t.h * 0.88 : t.kind === 'needle' ? t.h * 0.3 : t.h * 0.42;
      const trunkR = t.kind === 'palm' ? 0.2 : Math.max(0.14, t.crown * 0.045);
      // 줄기
      pos.set(it.x, it.y, trunkH / 2);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd * Math.PI * 2);
      scl.set(trunkR, trunkR, trunkH);
      mtx.compose(pos, q, scl);
      trunks.setMatrixAt(i, mtx);
      col.setHSL(0.08, 0.22, 0.24 + rnd * 0.06);
      trunks.setColorAt(i, col);
      // 수관
      const r = t.crown / 2;
      const k = t.kind;
      const idx = counts[k]++;
      if (k === 'broad') {
        const ch = Math.max(r * 1.5, t.h - trunkH);
        pos.set(it.x, it.y, trunkH + ch / 2 - r * 0.15);
        scl.set(r * (0.92 + rnd * 0.16), r * (0.92 + (1 - rnd) * 0.16), ch / 2);
      } else if (k === 'needle') {
        const ch = t.h - trunkH * 0.6;
        pos.set(it.x, it.y, trunkH * 0.6 + ch / 2);
        scl.set(r, r, ch);
      } else {
        pos.set(it.x, it.y, trunkH);
        scl.set(r, r, r * 0.55);
      }
      mtx.compose(pos, q, scl);
      crownMesh[k].setMatrixAt(idx, mtx);
      const g = greens[k];
      col.setRGB(g[0] * (0.86 + rnd * 0.28), g[1] * (0.9 + rnd * 0.2), g[2] * (0.86 + (1 - rnd) * 0.24));
      crownMesh[k].setColorAt(idx, col);
      // 지면 그림자
      pos.set(it.x + r * 0.25, it.y + r * 0.3, 0.06);
      scl.set(r * 1.35, r * 1.35, 1);
      mtx.compose(pos, new THREE.Quaternion(), scl);
      shadows.setMatrixAt(i, mtx);
    });

    trunks.count = list.length;
    shadows.count = list.length;
    broad.count = counts.broad;
    needle.count = counts.needle;
    palm.count = counts.palm;
    for (const m of this.treeMeshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.stats.trees = list.length;
    this.map?.triggerRepaint();
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.renderer || !this.visible || !this.buildingMesh) return;
    const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
    const l = new THREE.Matrix4()
      .makeTranslation(this.origin.x, this.origin.y, this.origin.z ?? 0)
      .scale(new THREE.Vector3(this.scale, this.scale, this.scale));
    this.camera.projectionMatrix = m.multiply(l);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }
}

function hash(v: number): number {
  const s = Math.sin(v) * 43758.5453;
  return s - Math.floor(s);
}

function zUp<T extends THREE.BufferGeometry>(g: T): T {
  g.rotateX(Math.PI / 2);
  return g;
}

function fixWinding(g: THREE.BufferGeometry): THREE.BufferGeometry {
  // three.js 기본 도형도 건물과 같은 감기 보정을 적용합니다.
  if (!FLIP_WINDING) return g;
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  return g;
}

let shadowTexture: THREE.Texture | null = null;
function getShadowTexture(): THREE.Texture {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(20,30,25,0.42)');
  g.addColorStop(0.6, 'rgba(20,30,25,0.18)');
  g.addColorStop(1, 'rgba(20,30,25,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

function palmCrown(): THREE.BufferGeometry {
  // 잎 8장을 방사형으로 늘어뜨린 단순 형태 (단위 반경 1)
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.SphereGeometry(1, 8, 4);
    leaf.scale(0.6, 0.24, 0.08);
    leaf.translate(0.55, 0, 0);
    leaf.rotateY(0.5); // 바깥으로 처지게 (y축 기준)
    leaf.rotateZ((i / 8) * Math.PI * 2);
    parts.push(leaf.toNonIndexed());
  }
  const merged = mergeNonIndexed(parts);
  // rotateY는 x→-z 방향으로 기울이므로 잎 끝이 아래로 처집니다.
  return merged;
}

function mergeNonIndexed(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const p of parts) {
    pos.push(...(p.getAttribute('position').array as Float32Array));
    nor.push(...(p.getAttribute('normal').array as Float32Array));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (FLIP_WINDING) {
    const a = g.getAttribute('position').array as Float32Array;
    const n = g.getAttribute('normal').array as Float32Array;
    for (let i = 0; i < a.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const t = a[i + 3 + k];
        a[i + 3 + k] = a[i + 6 + k];
        a[i + 6 + k] = t;
        const u = n[i + 3 + k];
        n[i + 3 + k] = n[i + 6 + k];
        n[i + 6 + k] = u;
      }
    }
  }
  return g;
}

function createTreeMeshes(n: number): THREE.InstancedMesh[] {
  const count = Math.max(1, n);
  const lambert = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  // 줄기: 높이 1, 반경 1 (z 위로 중심 정렬)
  const trunkGeo = fixWinding(zUp(new THREE.CylinderGeometry(0.75, 1, 1, 6)));
  // 둥근 수관: 단위 구 → 타원체로 확대
  const broadGeo = fixWinding(new THREE.IcosahedronGeometry(1, 1));
  // 침엽수: 높이 1, 반경 1 원뿔
  const needleGeo = fixWinding(zUp(new THREE.ConeGeometry(1, 1, 8)));
  const palmGeo = palmCrown();
  const shadowGeo = fixWinding(new THREE.PlaneGeometry(2, 2));

  const trunks = new THREE.InstancedMesh(trunkGeo, lambert(), count);
  const broad = new THREE.InstancedMesh(broadGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), count);
  const needle = new THREE.InstancedMesh(needleGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), count);
  const palm = new THREE.InstancedMesh(palmGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), count);
  const shadows = new THREE.InstancedMesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    count,
  );
  shadows.renderOrder = -1;
  for (const m of [trunks, broad, needle, palm]) {
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.count = 0;
  }
  shadows.count = 0;
  [trunks, broad, needle, palm, shadows].forEach((m) => (m.frustumCulled = false));
  return [trunks, broad, needle, palm, shadows];
}
