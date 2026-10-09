// OSM 건물 자료 → 하나로 합친 BufferGeometry 배열.
// 좌표계: 원점 기준 미터, x=동쪽, y=남쪽(메르카토르 y 방향), z=위.
import * as THREE from 'three';
import type { DetailBuilding, WallMaterial } from '../lib/detailTypes';

export type Projector = (lng: number, lat: number) => [number, number];
type V2 = [number, number];
type V3 = [number, number, number];

const MATERIAL_CODE: Record<WallMaterial, number> = {
  plaster: 0,
  brick: 1,
  stone: 2,
  glass: 3,
  concrete: 4,
  wood: 5,
};

/**
 * 삼각형 감기 방향 보정값.
 * 메르카토르 좌표(y=남쪽)는 z=위와 함께 왼손 좌표계를 이루므로,
 * 오른손 기준으로 만든 삼각형을 뒤집어야 바깥면이 앞면이 됩니다.
 * (브라우저 검증에서 확인한 값)
 */
export const FLIP_WINDING = true;

class Writer {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  wall: number[] = [];

  tri(a: V3, b: V3, c: V3, color: THREE.Color, wa?: [number[], number[], number[]]) {
    const n = normal(a, b, c);
    if (!n) return;
    const verts = FLIP_WINDING ? [a, c, b] : [a, b, c];
    const walls = wa ? (FLIP_WINDING ? [wa[0], wa[2], wa[1]] : wa) : undefined;
    for (let i = 0; i < 3; i++) {
      const v = verts[i];
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color.r, color.g, color.b);
      const w = walls?.[i];
      if (w) this.wall.push(w[0], w[1], w[2], w[3]);
      else this.wall.push(0, v[2], -1, 0);
    }
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aWall', new THREE.Float32BufferAttribute(this.wall, 4));
    g.computeBoundingSphere();
    return g;
  }
}

function normal(a: V3, b: V3, c: V3): V3 | null {
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2];
  const vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-9) return null;
  nx /= l;
  ny /= l;
  nz /= l;
  return [nx, ny, nz];
}

function signedArea(r: V2[]): number {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
}

/** 외곽선은 양의 면적, 중정은 음의 면적으로 맞춥니다. */
function orient(r: V2[], positive: boolean): V2[] {
  const a = signedArea(r);
  return (a > 0) === positive ? r : [...r].reverse();
}

function walls(
  w: Writer,
  ring: V2[],
  z0: number,
  z1: number | ((i: number) => number),
  color: THREE.Color,
  mat: number,
  windows: boolean,
) {
  let u = 0;
  const top = typeof z1 === 'number' ? () => z1 : z1;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i];
    const b = ring[j];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.05) continue;
    const ta = top(i);
    const tb = top(j);
    const win = windows && len >= 2.5 ? 1 : 0;
    const a0: V3 = [a[0], a[1], z0];
    const b0: V3 = [b[0], b[1], z0];
    const b1: V3 = [b[0], b[1], tb];
    const a1: V3 = [a[0], a[1], ta];
    const wa0 = [u, z0, mat, win];
    const wb0 = [u + len, z0, mat, win];
    const wb1 = [u + len, tb, mat, win];
    const wa1 = [u, ta, mat, win];
    w.tri(a0, b0, b1, color, [wa0, wb0, wb1]);
    w.tri(a0, b1, a1, color, [wa0, wb1, wa1]);
    u += len;
  }
}

function cap(
  w: Writer,
  outer: V2[],
  holes: V2[][],
  z: number | ((p: V2) => number),
  up: boolean,
  color: THREE.Color,
) {
  const contour = outer.map((p) => new THREE.Vector2(p[0], p[1]));
  const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
  let tris: number[][];
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, hs);
  } catch {
    return;
  }
  const all = [...outer, ...holes.flat()];
  const zf = typeof z === 'number' ? () => z : z;
  for (const t of tris) {
    const p = t.map((i) => all[i]);
    const v = p.map((q) => [q[0], q[1], zf(q)] as V3);
    const n = normal(v[0], v[1], v[2]);
    if (!n) continue;
    const facesUp = n[2] > 0;
    if (facesUp === up) w.tri(v[0], v[1], v[2], color);
    else w.tri(v[0], v[2], v[1], color);
  }
}

/** 주축 분석으로 긴 방향(e1)·짧은 방향(e2)을 구합니다. */
function axes(ring: V2[]) {
  const n = ring.length;
  const cx = ring.reduce((s, p) => s + p[0], 0) / n;
  const cy = ring.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    // 변 길이 가중치로 꼭짓점 밀집에 덜 민감하게
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (a[0] + b[0]) / 2 - cx;
    const dy = (a[1] + b[1]) / 2 - cy;
    sxx += dx * dx * len;
    syy += dy * dy * len;
    sxy += dx * dy * len;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const e1: V2 = [Math.cos(ang), Math.sin(ang)];
  const e2: V2 = [-e1[1], e1[0]];
  let amin = Infinity,
    amax = -Infinity,
    bmin = Infinity,
    bmax = -Infinity;
  for (const p of ring) {
    const a = (p[0] - cx) * e1[0] + (p[1] - cy) * e1[1];
    const b = (p[0] - cx) * e2[0] + (p[1] - cy) * e2[1];
    amin = Math.min(amin, a);
    amax = Math.max(amax, a);
    bmin = Math.min(bmin, b);
    bmax = Math.max(bmax, b);
  }
  const halfA = (amax - amin) / 2;
  const halfB = (bmax - bmin) / 2;
  // e1이 항상 긴 방향이 되도록
  if (halfB > halfA) {
    return {
      cx,
      cy,
      e1: e2,
      e2: [-e1[0], -e1[1]] as V2,
      midA: (bmin + bmax) / 2,
      midB: -(amin + amax) / 2,
      halfA: halfB,
      halfB: halfA,
    };
  }
  return { cx, cy, e1, e2, midA: (amin + amax) / 2, midB: (bmin + bmax) / 2, halfA, halfB };
}

function roof(w: Writer, ring: V2[], b: DetailBuilding, wallTop: number, color: THREE.Color) {
  const shape = b.roof.shape;
  const rh = b.roof.h;
  const ax = axes(ring);
  const local = ring.map((p) => {
    const dx = p[0] - ax.cx;
    const dy = p[1] - ax.cy;
    return [dx * ax.e1[0] + dy * ax.e1[1], dx * ax.e2[0] + dy * ax.e2[1]] as V2;
  });
  const toWorld = (a: number, bb: number): V2 => [
    ax.cx + ax.e1[0] * a + ax.e2[0] * bb,
    ax.cy + ax.e1[1] * a + ax.e2[1] * bb,
  ];

  if (shape === 'skillion') {
    const bmin = Math.min(...local.map((p) => p[1]));
    const bmax = Math.max(...local.map((p) => p[1]));
    const span = Math.max(0.1, bmax - bmin);
    const zAt = (i: number) => wallTop + (rh * (local[i][1] - bmin)) / span;
    walls(w, ring, wallTop, zAt, color, -1, false);
    const zMap = new Map(ring.map((p, i) => [p[0] + ',' + p[1], zAt(i)]));
    cap(w, ring, [], (p) => zMap.get(p[0] + ',' + p[1]) ?? wallTop, true, color);
    return;
  }

  type Profile = { sA: (t: number) => number; sB: (t: number) => number; f: (t: number) => number; steps: number };
  const ratio = ax.halfA > 0 ? Math.min(1, ax.halfB / ax.halfA) : 1;
  const profiles: Record<string, Profile> = {
    gabled: { sA: () => 1, sB: (t) => 1 - t, f: (t) => t, steps: 1 },
    hipped: { sA: (t) => 1 - t * ratio, sB: (t) => 1 - t, f: (t) => t, steps: 1 },
    pyramidal: { sA: (t) => 1 - t, sB: (t) => 1 - t, f: (t) => t, steps: 1 },
    cone: { sA: (t) => 1 - t, sB: (t) => 1 - t, f: (t) => t, steps: 1 },
    dome: {
      sA: (t) => Math.cos((t * Math.PI) / 2),
      sB: (t) => Math.cos((t * Math.PI) / 2),
      f: (t) => Math.sin((t * Math.PI) / 2),
      steps: 6,
    },
    onion: {
      sA: (t) => Math.max(0, (1 - t) * (1 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.4)))),
      sB: (t) => Math.max(0, (1 - t) * (1 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.4)))),
      f: (t) => t,
      steps: 7,
    },
    round: {
      sA: () => 1,
      sB: (t) => Math.cos((t * Math.PI) / 2),
      f: (t) => Math.sin((t * Math.PI) / 2),
      steps: 5,
    },
  };
  const pr = profiles[shape];
  if (!pr) return;

  const ringAt = (t: number): V3[] =>
    local.map(([a, bb]) => {
      const p = toWorld(ax.midA + (a - ax.midA) * pr.sA(t), ax.midB + (bb - ax.midB) * pr.sB(t));
      return [p[0], p[1], wallTop + rh * pr.f(t)] as V3;
    });

  let prev = ringAt(0);
  for (let s = 1; s <= pr.steps; s++) {
    const next = ringAt(s / pr.steps);
    for (let i = 0; i < prev.length; i++) {
      const j = (i + 1) % prev.length;
      w.tri(prev[i], prev[j], next[j], color);
      w.tri(prev[i], next[j], next[i], color);
    }
    prev = next;
  }
}

export interface BuildResult {
  geometry: THREE.BufferGeometry;
  triangles: number;
}

export function buildBuildings(buildings: DetailBuilding[], project: Projector): BuildResult {
  const w = new Writer();
  const wallColor = new THREE.Color();
  const roofColor = new THREE.Color();

  for (const b of buildings) {
    const outer = orient(
      b.outer.map(([lng, lat]) => project(lng, lat)),
      true,
    );
    const holes = b.holes.map((h) => orient(h.map(([lng, lat]) => project(lng, lat)), false));
    if (outer.length < 3 || Math.abs(signedArea(outer)) < 1) continue;

    wallColor.set(b.wall);
    roofColor.set(b.roofColor);
    const wallTop = Math.max(b.minH + 0.3, b.h - b.roof.h);
    const mat = MATERIAL_CODE[b.material] ?? 0;
    const windows = wallTop - b.minH >= 4.5;

    walls(w, outer, b.minH, wallTop, wallColor, mat, windows);
    for (const h of holes) walls(w, h, b.minH, wallTop, wallColor, mat, windows);
    if (b.minH > 0.3) cap(w, outer, holes, b.minH, false, wallColor);

    if (b.roof.shape === 'flat' || b.roof.h <= 0.2 || holes.length > 0) {
      cap(w, outer, holes, wallTop, true, roofColor);
    } else {
      roof(w, outer, b, wallTop, roofColor);
    }
  }
  const geometry = w.toGeometry();
  return { geometry, triangles: w.pos.length / 9 };
}

/** 건물 벽 셰이더: 층·칸 단위의 절제된 창문과 재질 질감, 바닥 쪽 그늘 */
export function createBuildingMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWall;\nvarying vec4 vWall;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vWall;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (vWall.z > -0.5) {
  float u = vWall.x; float z = vWall.y; float mat = vWall.z;
  // 재질 질감 (아주 약하게)
  float n = h21(floor(vec2(u*1.6, z*2.2)));
  float grain = mat < 0.5 ? 0.025 : (mat < 1.5 ? 0.07 : (mat < 2.5 ? 0.05 : 0.035));
  vec3 base = diffuseColor.rgb * (1.0 - grain + 2.0*grain*n);
  if (mat > 0.5 && mat < 1.5) { // 벽돌 줄눈
    float course = smoothstep(0.0, 0.02, abs(fract(z/0.42)-0.5)-0.46);
    base *= 1.0 - 0.06*course;
  }
  if (mat > 1.5 && mat < 2.5) { // 석재 블록
    float joint = step(0.47, abs(fract(z/0.9)-0.5));
    base *= 1.0 - 0.05*joint;
  }
  // 창문: 층 높이 3.2m, 칸 폭 3.0m(유리 외벽은 더 촘촘하게)
  float lvl = 3.2;
  float bay = mat > 2.5 && mat < 3.5 ? 1.6 : 3.0;
  vec2 cell = vec2(fract(u/bay), fract(z/lvl));
  float floorIdx = floor(z/lvl);
  float win = smoothstep(0.24,0.27,cell.x)*(1.0-smoothstep(0.73,0.76,cell.x))
            * smoothstep(0.32,0.35,cell.y)*(1.0-smoothstep(0.76,0.79,cell.y));
  win *= vWall.w * step(0.5, floorIdx);
  float lit = h21(vec2(floor(u/bay), floorIdx));
  vec3 glass = mix(vec3(0.20,0.25,0.29), vec3(0.34,0.40,0.44), lit);
  float strength = mat > 2.5 && mat < 3.5 ? 0.6 : 0.42;
  base = mix(base, glass, win*strength);
  // 바닥 근처를 살짝 어둡게
  base *= mix(0.80, 1.0, smoothstep(0.0, 2.6, z));
  diffuseColor.rgb = base;
}`,
      );
  };
  return m;
}
