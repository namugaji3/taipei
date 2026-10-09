// OpenStreetMap(osmtogeojson 결과) → 날짜별 상세 자료 변환.
// 브라우저가 아닌 자료 생성 스크립트와 테스트에서 사용합니다.
import type {
  DayDetail,
  DetailBuilding,
  DetailMask,
  DetailTree,
  LngLat,
  RoofShape,
  TreeKind,
  WallMaterial,
} from './detailTypes';

type Tags = Record<string, string>;
interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry:
    | { type: 'Point'; coordinates: number[] }
    | { type: 'LineString'; coordinates: number[][] }
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: string; coordinates: unknown };
}
export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

const LEVEL_M = 3.2;

// ───────────── 기하 도우미 ─────────────
export function metersBetween(a: LngLat, b: LngLat): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(p: LngLat, outer: LngLat[], holes: LngLat[][]): boolean {
  if (!pointInRing(p, outer)) return false;
  return !holes.some((h) => pointInRing(p, h));
}

function ringCentroid(ring: LngLat[]): LngLat {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-18) {
    const n = ring.length;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** 오목한 윤곽에서도 내부에 있는 대표점 */
export function interiorPoint(outer: LngLat[], holes: LngLat[][] = []): LngLat {
  const c = ringCentroid(outer);
  if (pointInPolygon(c, outer, holes)) return c;
  // 가로 스캔선으로 내부 구간의 중점을 찾습니다.
  const ys = outer.map((p) => p[1]).sort((a, b) => a - b);
  for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
    const y = ys[0] + (ys[ys.length - 1] - ys[0]) * t;
    const xs: number[] = [];
    for (const ring of [outer, ...holes]) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const p: LngLat = [(xs[k] + xs[k + 1]) / 2, y];
      if (pointInPolygon(p, outer, holes)) return p;
    }
  }
  return outer[0];
}

function cleanRing(raw: number[][]): LngLat[] {
  const ring: LngLat[] = raw.map((c) => [round7(c[0]), round7(c[1])]);
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) ring.pop();
  }
  // 연속 중복 점 제거
  return ring.filter((p, i) => {
    const q = ring[(i - 1 + ring.length) % ring.length];
    return i === 0 ? true : !(p[0] === q[0] && p[1] === q[1]);
  });
}

const round7 = (v: number) => Math.round(v * 1e7) / 1e7;

// ───────────── 태그 해석 ─────────────
export function parseLength(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase().replace(',', '.');
  const ft = s.match(/^([\d.]+)\s*(ft|'|feet)$/);
  if (ft) return Number(ft[1]) * 0.3048;
  const m = s.match(/^(-?[\d.]+)\s*(m|meter|meters|metre|metres)?$/);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseNumber(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const NAMED_COLORS: Record<string, string> = {
  white: '#ece9e2',
  black: '#2b2b2b',
  grey: '#9a9a96',
  gray: '#9a9a96',
  silver: '#b9bcbd',
  red: '#9d3b31',
  darkred: '#7a2a24',
  maroon: '#6f2a25',
  brown: '#7c5a43',
  beige: '#d9cdb2',
  tan: '#c7ad86',
  yellow: '#d8c27a',
  orange: '#c27a3f',
  green: '#5f7d5c',
  darkgreen: '#3e5a40',
  blue: '#5d7a92',
  lightblue: '#9fb5c3',
  cream: '#e6dcc4',
  ivory: '#ebe6d6',
  pink: '#c99a94',
};

export function parseColour(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  return NAMED_COLORS[s.replace(/[\s_-]/g, '')];
}

const WALL_MATERIAL: Record<string, { mat: WallMaterial; color: string }> = {
  brick: { mat: 'brick', color: '#9a5c45' },
  stone: { mat: 'stone', color: '#b5ad9f' },
  sandstone: { mat: 'stone', color: '#c6b18e' },
  marble: { mat: 'stone', color: '#ddd8ce' },
  granite: { mat: 'stone', color: '#a9a49c' },
  plaster: { mat: 'plaster', color: '#dcd5c6' },
  stucco: { mat: 'plaster', color: '#dbd2c1' },
  concrete: { mat: 'concrete', color: '#bab7ae' },
  cement_block: { mat: 'concrete', color: '#b4b0a6' },
  glass: { mat: 'glass', color: '#8ea2ab' },
  wood: { mat: 'wood', color: '#8a6a4c' },
  timber_framing: { mat: 'wood', color: '#8a6a4c' },
  metal: { mat: 'concrete', color: '#9ca2a5' },
  tiles: { mat: 'plaster', color: '#c9c0b2' },
};

const ROOF_MATERIAL: Record<string, string> = {
  roof_tiles: '#985a44',
  tile: '#985a44',
  tiles: '#985a44',
  slate: '#5c6166',
  metal: '#868c90',
  tin: '#868c90',
  copper: '#5f8b7a',
  concrete: '#a6a29a',
  glass: '#92a6ae',
  wood: '#77593f',
  asphalt: '#5f5f5d',
  thatch: '#a38b5b',
};

const PLASTER_TONES = ['#d8d2c4', '#cdc8bc', '#d4cdbf', '#c7c3b8', '#d9d3c9', '#c9c1b2', '#d1cbbf'];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const ROOF_ALIASES: Record<string, RoofShape> = {
  flat: 'flat',
  gabled: 'gabled',
  saltbox: 'gabled',
  gambrel: 'gabled',
  hipped: 'hipped',
  half_hipped: 'hipped',
  mansard: 'hipped',
  side_hipped: 'hipped',
  pyramidal: 'pyramidal',
  dome: 'dome',
  onion: 'onion',
  cone: 'cone',
  conical: 'cone',
  spire: 'cone',
  skillion: 'skillion',
  lean_to: 'skillion',
  round: 'round',
  barrel: 'round',
};

function tagsOf(f: GeoFeature): Tags {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const nested = p.tags as Tags | undefined;
  if (nested && typeof nested === 'object') return nested;
  const t: Tags = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === 'string') t[k] = v;
  return t;
}

function idOf(f: GeoFeature): string {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const raw = (f.id ?? p.id ?? p['@id'] ?? '') as string | number;
  return String(raw);
}

interface RawPoly {
  id: string;
  tags: Tags;
  part: boolean;
  outer: LngLat[];
  holes: LngLat[][];
}

function polygonsOf(f: GeoFeature): { outer: LngLat[]; holes: LngLat[][] }[] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') {
    const rings = (g.coordinates as number[][][]).map(cleanRing);
    return rings[0] && rings[0].length >= 3
      ? [{ outer: rings[0], holes: rings.slice(1).filter((r) => r.length >= 3) }]
      : [];
  }
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as number[][][][])
      .map((poly) => poly.map(cleanRing))
      .filter((rings) => rings[0] && rings[0].length >= 3)
      .map((rings) => ({ outer: rings[0], holes: rings.slice(1).filter((r) => r.length >= 3) }));
  }
  return [];
}

function buildingFrom(raw: RawPoly): DetailBuilding {
  const t = raw.tags;
  const levels = parseNumber(t['building:levels']);
  const roofLevels = parseNumber(t['roof:levels']) ?? 0;
  const minLevel = parseNumber(t['building:min_level']);
  const heightTag = parseLength(t.height);
  const minHeightTag = parseLength(t.min_height);

  let shape: RoofShape = ROOF_ALIASES[(t['roof:shape'] ?? 'flat').toLowerCase()] ?? 'flat';
  // 중정이 있는 건물의 경사 지붕은 형태를 신뢰성 있게 근사할 수 없어 평지붕으로 둡니다.
  if (raw.holes.length > 0 && shape !== 'flat') shape = 'flat';

  let roofH = parseLength(t['roof:height']);
  let estRoof = false;
  if (roofH === undefined) {
    if (roofLevels > 0) roofH = roofLevels * LEVEL_M;
    else if (shape !== 'flat') {
      roofH = shape === 'cone' ? 6 : shape === 'dome' || shape === 'onion' ? 4 : 3;
      estRoof = true;
    } else roofH = 0;
  }

  let h: number;
  let estH = false;
  if (heightTag !== undefined && heightTag > 0) h = heightTag;
  else if (levels !== undefined && levels > 0) h = levels * LEVEL_M + (shape !== 'flat' ? roofH : 0);
  else {
    // 기록이 없으면 일정한 범위로 추정 (주거·소형 건물 기준 3층)
    const type = t.building ?? t['building:part'] ?? '';
    const base = ['house', 'shed', 'hut', 'kiosk', 'garage', 'roof', 'shrine'].includes(type) ? 2 : 3;
    h = base * LEVEL_M + (shape !== 'flat' ? roofH : 0);
    estH = true;
  }
  if (t.building === 'roof' || t['building:part'] === 'roof') {
    // 지붕만 있는 구조물: 얇게 띄워 표현
    if (minHeightTag === undefined && minLevel === undefined) {
      return finish(Math.max(h - 0.6, 2.4));
    }
  }
  return finish(minHeightTag ?? (minLevel !== undefined ? minLevel * LEVEL_M : 0));

  function finish(minH: number): DetailBuilding {
    let rh = Math.min(roofH ?? 0, Math.max(0, h - minH - 0.5));
    if (shape === 'flat') rh = 0;
    const matKey = (t['building:material'] ?? '').toLowerCase();
    const mat = WALL_MATERIAL[matKey];
    const tone = PLASTER_TONES[hashString(raw.id) % PLASTER_TONES.length];
    const wall = parseColour(t['building:colour']) ?? mat?.color ?? tone;
    const roofColor =
      parseColour(t['roof:colour']) ??
      ROOF_MATERIAL[(t['roof:material'] ?? '').toLowerCase()] ??
      (shape === 'flat' ? darken(wall, 0.9) : '#877b70');
    return {
      id: raw.id,
      part: raw.part,
      outer: raw.outer,
      holes: raw.holes,
      minH: Math.max(0, Math.round(minH * 10) / 10),
      h: Math.max(minH + 1, Math.round(h * 10) / 10),
      roof: { shape, h: Math.round(rh * 10) / 10 },
      wall,
      roofColor,
      material: mat?.mat ?? 'plaster',
      estH,
      estRoof: estRoof && shape !== 'flat',
      ...(t.name ? { name: t.name } : {}),
    };
  }
}

const PALM_RE =
  /(arecaceae|palmae|palm|roystonea|washingtonia|phoenix|livistona|archontophoenix|cocos|areca|caryota|syagrus|trachycarpus|dypsis|椰|棕櫚|棕榈|蒲葵)/i;

function treeKind(t: Tags): TreeKind {
  const text = [t.genus, t.species, t['species:en'], t['species:zh'], t.taxon, t.family, t.name]
    .filter(Boolean)
    .join(' ');
  if (PALM_RE.test(text) || t['leaf_type'] === 'palm') return 'palm';
  if (t['leaf_type'] === 'needleleaved') return 'needle';
  return 'broad';
}

function treeFrom(p: LngLat, t: Tags, row = false): DetailTree {
  const kind = treeKind(t);
  const hTag = parseLength(t.height) ?? parseLength(t.est_height);
  const cTag = parseLength(t.diameter_crown);
  const defaults: Record<TreeKind, [number, number]> = {
    broad: [8, 5.5],
    needle: [9, 3.6],
    palm: [9, 4.2],
  };
  const [dh, dc] = defaults[kind];
  return {
    p: [round7(p[0]), round7(p[1])],
    h: clamp(hTag ?? dh, 2.5, 30),
    crown: clamp(cTag ?? dc, 1.5, 18),
    kind,
    est: hTag === undefined || cTag === undefined,
    ...(row ? { row: true } : {}),
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function inMasks(p: LngLat, masks: DetailMask[]): boolean {
  return masks.some((m) => metersBetween(p, m.center) <= m.r);
}

export interface ProcessOptions {
  day: number;
  masks: DetailMask[];
  generatedAt?: string;
  treeRowSpacingM?: number;
}

export function processOsm(fc: GeoCollection, opts: ProcessOptions): DayDetail {
  const spacing = opts.treeRowSpacingM ?? 8;
  const polys: RawPoly[] = [];
  const trees: DetailTree[] = [];

  for (const f of fc.features) {
    const t = tagsOf(f);
    const id = idOf(f);
    const isPart = t['building:part'] !== undefined && t['building:part'] !== 'no';
    const isBuilding = t.building !== undefined && t.building !== 'no';
    if (isPart || isBuilding) {
      for (const p of polygonsOf(f)) polys.push({ id, tags: t, part: isPart, ...p });
      continue;
    }
    if (t.natural === 'tree' && f.geometry?.type === 'Point') {
      const c = f.geometry.coordinates as number[];
      trees.push(treeFrom([c[0], c[1]], t));
      continue;
    }
    if (t.natural === 'tree_row' && f.geometry?.type === 'LineString') {
      const line = (f.geometry.coordinates as number[][]).map((c) => [c[0], c[1]] as LngLat);
      for (const p of sampleLine(line, spacing)) trees.push(treeFrom(p, t, true));
    }
  }

  // 1) 범위 안 (대표점 기준)
  const inside = polys.filter((p) => inMasks(interiorPoint(p.outer, p.holes), opts.masks));

  // 2) building:part가 있으면 전체 건물 외곽은 그리지 않습니다.
  const parts = inside.filter((p) => p.part);
  const partPoints = parts.map((p) => interiorPoint(p.outer, p.holes));
  let replaced = 0;
  const kept = inside.filter((p) => {
    if (p.part) return true;
    const hasPart = partPoints.some((pt) => pointInRing(pt, p.outer));
    if (hasPart) replaced++;
    return !hasPart;
  });

  const buildings = kept.map(buildingFrom);

  // 3) 나무: 범위 안 + 건물 내부(중정 제외)에 있는 점 제외
  const grid = new BBoxGrid(buildings);
  let dropped = 0;
  const keptTrees = trees.filter((tr) => {
    if (!inMasks(tr.p, opts.masks)) return false;
    const inside = grid
      .candidates(tr.p)
      .some((b) => b.minH < 2 && pointInPolygon(tr.p, b.outer, b.holes));
    if (inside) dropped++;
    return !inside;
  });

  const origin = opts.masks.length
    ? ([
        opts.masks.reduce((s, m) => s + m.center[0], 0) / opts.masks.length,
        opts.masks.reduce((s, m) => s + m.center[1], 0) / opts.masks.length,
      ] as LngLat)
    : ([0, 0] as LngLat);

  return {
    version: 1,
    day: opts.day,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    origin: [round7(origin[0]), round7(origin[1])],
    masks: opts.masks,
    buildings,
    trees: keptTrees,
    stats: {
      buildings: buildings.filter((b) => !b.part).length,
      parts: buildings.filter((b) => b.part).length,
      outlinesReplacedByParts: replaced,
      estimatedHeights: buildings.filter((b) => b.estH).length,
      courtyards: buildings.reduce((s, b) => s + b.holes.length, 0),
      nonFlatRoofs: buildings.filter((b) => b.roof.shape !== 'flat').length,
      trees: keptTrees.length,
      treesDroppedInsideBuildings: dropped,
    },
  };
}

export function sampleLine(line: LngLat[], spacingM: number): LngLat[] {
  const out: LngLat[] = [];
  let walked = 0; // 지금까지 걸어온 거리
  let next = 0; // 다음 나무를 놓을 거리
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const len = metersBetween(a, b);
    while (len > 0 && next <= walked + len) {
      const t = (next - walked) / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      next += spacingM;
    }
    walked += len;
  }
  return out;
}

class BBoxGrid {
  private cells = new Map<string, DetailBuilding[]>();
  private size = 0.0006; // 약 60m
  constructor(items: DetailBuilding[]) {
    for (const b of items) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of b.outer) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      for (let gx = Math.floor(minX / this.size); gx <= Math.floor(maxX / this.size); gx++)
        for (let gy = Math.floor(minY / this.size); gy <= Math.floor(maxY / this.size); gy++) {
          const k = gx + ':' + gy;
          const arr = this.cells.get(k);
          if (arr) arr.push(b);
          else this.cells.set(k, [b]);
        }
    }
  }
  candidates(p: LngLat): DetailBuilding[] {
    return this.cells.get(Math.floor(p[0] / this.size) + ':' + Math.floor(p[1] / this.size)) ?? [];
  }
}
