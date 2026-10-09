// 테스트 전용 합성 OSM 자료 (실제 지도 자료가 아닙니다).
const LNG = 121.5115;
const LAT = 25.049;
const dLng = 1 / (111320 * Math.cos((LAT * Math.PI) / 180)); // 1m
const dLat = 1 / 110574;

let nid = 1;
const nodes: { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }[] = [];
function node(x: number, y: number, tags?: Record<string, string>) {
  const n = { type: 'node' as const, id: nid++, lon: LNG + x * dLng, lat: LAT + y * dLat, ...(tags ? { tags } : {}) };
  nodes.push(n);
  return n.id;
}
function ring(pts: [number, number][]) {
  const ids = pts.map(([x, y]) => node(x, y));
  return [...ids, ids[0]];
}
let wid = 1000;
const ways: { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }[] = [];
function way(ids: number[], tags?: Record<string, string>) {
  const w = { type: 'way' as const, id: wid++, nodes: ids, ...(tags ? { tags } : {}) };
  ways.push(w);
  return w.id;
}

export function makeOsm() {
  nodes.length = 0;
  ways.length = 0;
  // 1) 중정이 있는 ㅁ자 건물 (멀티폴리곤) – 2층, 벽돌
  const outer = way(ring([[-60, -20], [-10, -20], [-10, 30], [-60, 30]]));
  const inner = way(ring([[-45, -5], [-25, -5], [-25, 15], [-45, 15]]));
  const relations = [
    {
      type: 'relation' as const,
      id: 5000,
      members: [
        { type: 'way', ref: outer, role: 'outer' },
        { type: 'way', ref: inner, role: 'inner' },
      ],
      tags: { type: 'multipolygon', building: 'yes', 'building:levels': '2', 'building:material': 'brick', 'roof:shape': 'flat', name: '테스트 중정 건물' },
    },
  ];
  // 2) 건물 외곽 + 부분 2개 (저층 몸체 + 첨탑)
  way(ring([[10, -20], [40, -20], [40, 10], [10, 10]]), { building: 'yes', height: '30' });
  way(ring([[10, -20], [40, -20], [40, 10], [10, 10]]), { 'building:part': 'yes', height: '12', 'roof:shape': 'flat', 'building:colour': '#e6dcc4' });
  way(ring([[20, -10], [30, -10], [30, 0], [20, 0]]), { 'building:part': 'yes', height: '34', min_height: '12', 'roof:shape': 'pyramidal', 'roof:height': '8', 'roof:colour': '#5f8b7a' });
  // 3) 박공지붕 집 (높이 기록 없음 → 층수 기반)
  way(ring([[55, -15], [80, -15], [80, -3], [55, -3]]), { building: 'house', 'building:levels': '2', 'roof:shape': 'gabled', 'roof:material': 'roof_tiles' });
  // 4) 곡선 윤곽 돔 (원형 24각)
  const circle: [number, number][] = [];
  for (let i = 0; i < 24; i++) circle.push([60 + 10 * Math.cos((i / 24) * Math.PI * 2), 30 + 10 * Math.sin((i / 24) * Math.PI * 2)]);
  way(ring(circle), { building: 'yes', height: '16', 'roof:shape': 'dome', 'roof:height': '7' });
  // 5) 높이 기록 없는 건물 (추정)
  way(ring([[-60, -60], [-20, -55], [-25, -35], [-60, -40]]), { building: 'yes' });
  // 6) 나무
  node(0, 40, { natural: 'tree', genus: 'Roystonea', height: '12' });
  node(5, 40, { natural: 'tree', leaf_type: 'needleleaved' });
  node(-5, 40, { natural: 'tree', diameter_crown: '7', height: '10' });
  node(-30, 5, { natural: 'tree' }); // 중정 안 → 남김
  node(-55, 25, { natural: 'tree' }); // 건물 안 → 제외
  way([node(-60, 50), node(40, 50)], { natural: 'tree_row' });
  // 7) 범위 밖 건물
  way(ring([[900, 900], [920, 900], [920, 920], [900, 920]]), { building: 'yes' });
  return { version: 0.6, elements: [...nodes, ...ways, ...relations] };
}

export const FIXTURE_CENTER: [number, number] = [LNG, LAT];
