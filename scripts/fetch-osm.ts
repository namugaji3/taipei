/**
 * 날짜별 상세 건물·가로수 자료 생성 (빌드 전 1회 실행)
 *
 *   npm run data            # 5일 전부
 *   npm run data -- 2 4     # 2일차, 4일차만
 *   OVERPASS_URL=https://overpass.kumi.systems/api/interpreter npm run data
 *
 * - 공개 Overpass API는 이 스크립트에서만 호출합니다. 웹페이지는 생성된
 *   public/data/day-N.json만 읽으므로 방문자가 Overpass를 호출하지 않습니다.
 * - 자료: © OpenStreetMap contributors, ODbL 1.0
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import osmtogeojson from 'osmtogeojson';
import { DAYS } from '../src/data/itinerary';
import { metersBetween, processOsm, type GeoCollection } from '../src/lib/osmProcess';
import type { DayDetail, DetailMask, LngLat } from '../src/lib/detailTypes';

const ENDPOINT = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data');
const DEFAULT_RADIUS = 360;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string, label: string): Promise<unknown> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'taipei-3d-travel-map/1.0 (static build script)',
      },
      body: 'data=' + encodeURIComponent(query),
    });
    if (res.ok) return res.json();
    const wait = attempt * 15000;
    console.warn(`  ${label}: Overpass ${res.status}, ${wait / 1000}초 후 재시도 (${attempt}/5)`);
    await sleep(wait);
  }
  throw new Error(`${label}: Overpass 요청 실패`);
}

function around(r: number, p: { lat: number; lng: number }) {
  return `(around:${r},${p.lat},${p.lng})`;
}

async function buildDay(dayId: number): Promise<DayDetail> {
  const day = DAYS.find((d) => d.id === dayId);
  if (!day) throw new Error(`${dayId}일차 없음`);
  const masks: DetailMask[] = day.places.map((p) => ({
    center: [p.lng, p.lat] as LngLat,
    r: p.radius ?? DEFAULT_RADIUS,
  }));

  // 범위 밖 대표점 건물도 걸러야 하므로 반경을 조금 넓혀 수집합니다.
  const sets = day.places
    .map((p) => {
      const a = around((p.radius ?? DEFAULT_RADIUS) + 80, p);
      return [
        `way["building"]${a};`,
        `relation["building"]${a};`,
        `way["building:part"]${a};`,
        `relation["building:part"]${a};`,
        `node["natural"="tree"]${a};`,
        `way["natural"="tree_row"]${a};`,
      ].join('\n');
    })
    .join('\n');
  const q = `[out:json][timeout:240];\n(\n${sets}\n);\nout body;\n>;\nout skel qt;`;
  console.log(`· ${dayId}일차: 건물·나무 수집 중…`);
  const raw = await overpass(q, `${dayId}일차`);
  const fc = osmtogeojson(raw, { flatProperties: true }) as GeoCollection;
  const detail = processOsm(fc, { day: dayId, masks });

  // 장소 좌표를 OSM 이름과 대조
  const named = day.places.filter((p) => p.osmName);
  if (named.length) {
    await sleep(3000);
    const nq =
      '[out:json][timeout:60];(\n' +
      named.map((p) => `nwr["name"~"${p.osmName}"]${around(900, p)};`).join('\n') +
      '\n);\nout tags center;';
    const nr = (await overpass(nq, `${dayId}일차 이름 대조`)) as {
      elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
    };
    detail.placeChecks = named.map((p) => {
      const re = new RegExp(p.osmName!);
      let best: { name: string; pos: LngLat; d: number } | undefined;
      for (const el of nr.elements) {
        const name = el.tags?.name;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!name || lat === undefined || lon === undefined || !re.test(name)) continue;
        const d = metersBetween([p.lng, p.lat], [lon, lat]);
        if (!best || d < best.d) best = { name, pos: [lon, lat], d };
      }
      return best
        ? { id: p.id, matched: best.name, offsetM: Math.round(best.d), osm: best.pos }
        : { id: p.id };
    });
  }
  return detail;
}

async function main() {
  const args = process.argv.slice(2).map(Number).filter(Boolean);
  const ids = args.length ? args : DAYS.map((d) => d.id);
  await mkdir(OUT, { recursive: true });
  for (const id of ids) {
    const d = await buildDay(id);
    const file = resolve(OUT, `day-${id}.json`);
    await writeFile(file, JSON.stringify(d));
    const s = d.stats;
    console.log(
      `  → day-${id}.json  건물 ${s.buildings} · 부분 ${s.parts} (외곽 대체 ${s.outlinesReplacedByParts}) · 중정 ${s.courtyards} · ` +
        `경사/돔 지붕 ${s.nonFlatRoofs} · 높이 추정 ${s.estimatedHeights} · 나무 ${s.trees} (건물 내부 제외 ${s.treesDroppedInsideBuildings})`,
    );
    for (const c of d.placeChecks ?? []) {
      const flag = c.offsetM === undefined ? '이름 일치 없음 — 좌표 수동 확인' : c.offsetM > 25 ? '보정 적용' : '일치';
      console.log(`    ${c.id}: ${c.matched ?? '-'} ${c.offsetM ?? ''}m  ${flag}`);
    }
    await sleep(8000); // 공개 서버 부담 줄이기
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
