import { describe, expect, it } from 'vitest';
import osmtogeojson from 'osmtogeojson';
import { processOsm, parseLength, sampleLine, type GeoCollection } from '../src/lib/osmProcess';
import { makeOsm, FIXTURE_CENTER } from './fixtures/makeOsm';

const detail = () =>
  processOsm(osmtogeojson(makeOsm(), { flatProperties: true }) as GeoCollection, {
    day: 1,
    masks: [{ center: FIXTURE_CENTER, r: 300 }],
    generatedAt: 'test',
  });

describe('processOsm', () => {
  it('중정(안쪽 고리)을 보존한다', () => {
    const d = detail();
    const court = d.buildings.find((b) => b.name === '테스트 중정 건물');
    expect(court).toBeDefined();
    expect(court!.holes.length).toBe(1);
    expect(court!.material).toBe('brick');
    expect(court!.h).toBeCloseTo(6.4);
    expect(court!.estH).toBe(false);
  });

  it('building:part가 있으면 외곽 건물을 중복으로 채우지 않는다', () => {
    const d = detail();
    expect(d.stats.outlinesReplacedByParts).toBe(1);
    expect(d.buildings.filter((b) => b.part).length).toBe(2);
    const spire = d.buildings.find((b) => b.part && b.minH === 12)!;
    expect(spire.h).toBe(34);
    expect(spire.roof).toEqual({ shape: 'pyramidal', h: 8 });
    expect(spire.roofColor).toBe('#5f8b7a');
    expect(d.buildings.some((b) => !b.part && b.h === 30)).toBe(false);
  });

  it('지붕 형태와 높이를 해석한다', () => {
    const d = detail();
    const house = d.buildings.find((b) => b.roof.shape === 'gabled')!;
    expect(house.estRoof).toBe(true);
    expect(house.h).toBeCloseTo(2 * 3.2 + 3);
    expect(house.roofColor).toBe('#985a44');
    const dome = d.buildings.find((b) => b.roof.shape === 'dome')!;
    expect(dome.outer.length).toBe(24);
    expect(dome.roof.h).toBe(7);
  });

  it('높이 기록이 없으면 추정 표시', () => {
    const d = detail();
    expect(d.buildings.filter((b) => b.estH).length).toBe(1);
  });

  it('범위 밖 건물은 제외', () => {
    const d = detail();
    expect(d.buildings.every((b) => b.outer.every((p) => Math.abs(p[0] - FIXTURE_CENTER[0]) < 0.005))).toBe(true);
  });

  it('나무 종류를 구분하고 건물 내부 나무는 뺀다 (중정 나무는 유지)', () => {
    const d = detail();
    const kinds = d.trees.filter((t) => !t.row).map((t) => t.kind).sort();
    expect(kinds).toEqual(['broad', 'broad', 'needle', 'palm']);
    expect(d.stats.treesDroppedInsideBuildings).toBe(1);
    const palm = d.trees.find((t) => t.kind === 'palm')!;
    expect(palm.h).toBe(12);
    expect(palm.est).toBe(true); // 수관 크기 없음
    expect(d.trees.filter((t) => t.row).length).toBeGreaterThanOrEqual(12);
  });
});

describe('helpers', () => {
  it('parseLength', () => {
    expect(parseLength('12')).toBe(12);
    expect(parseLength('12.5 m')).toBe(12.5);
    expect(parseLength("40'")).toBeCloseTo(12.19, 1);
    expect(parseLength('tall')).toBeUndefined();
  });
  it('sampleLine spacing', () => {
    const pts = sampleLine([[121.5, 25.0], [121.5 + 105 / 100900, 25.0]], 10);
    expect(pts.length).toBe(11);
  });
});
