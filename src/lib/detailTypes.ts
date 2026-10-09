// 날짜별 정적 상세 자료(public/data/day-N.json)의 형식.
// scripts/fetch-osm.ts가 OpenStreetMap 원자료에서 만들어 냅니다.

export type LngLat = [number, number];

export type RoofShape =
  | 'flat'
  | 'gabled'
  | 'hipped'
  | 'pyramidal'
  | 'dome'
  | 'onion'
  | 'cone'
  | 'skillion'
  | 'round';

export type WallMaterial = 'plaster' | 'brick' | 'stone' | 'glass' | 'concrete' | 'wood';

export interface DetailBuilding {
  /** OSM 객체 id (예: "way/123") */
  id: string;
  /** building:part 여부 */
  part: boolean;
  /** 외곽선 (닫는 점 제외) */
  outer: LngLat[];
  /** 중정·빈 공간 */
  holes: LngLat[][];
  /** 바닥 높이(m) – min_height 또는 building:min_level */
  minH: number;
  /** 지붕 꼭대기까지 전체 높이(m) – height 또는 층수 기반 */
  h: number;
  roof: { shape: RoofShape; h: number };
  wall: string;
  roofColor: string;
  material: WallMaterial;
  /** 높이 기록이 없어 추정한 경우 */
  estH: boolean;
  /** 지붕 높이를 추정한 경우 */
  estRoof: boolean;
  name?: string;
}

export type TreeKind = 'broad' | 'needle' | 'palm';

export interface DetailTree {
  p: LngLat;
  h: number;
  crown: number;
  kind: TreeKind;
  /** 높이·수관 크기를 추정한 경우 */
  est: boolean;
  /** tree_row 선을 일정 간격으로 나눈 위치인 경우 */
  row?: boolean;
}

export interface DetailMask {
  center: LngLat;
  r: number;
}

export interface DayDetail {
  version: 1;
  day: number;
  generatedAt: string;
  attribution: string;
  origin: LngLat;
  masks: DetailMask[];
  buildings: DetailBuilding[];
  trees: DetailTree[];
  stats: {
    buildings: number;
    parts: number;
    outlinesReplacedByParts: number;
    estimatedHeights: number;
    courtyards: number;
    nonFlatRoofs: number;
    trees: number;
    treesDroppedInsideBuildings: number;
  };
  /** 장소 좌표를 OSM 이름과 대조한 결과 */
  placeChecks?: { id: string; matched?: string; offsetM?: number; osm?: LngLat }[];
}
