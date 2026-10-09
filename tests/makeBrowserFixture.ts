// 브라우저 검증용 임시 자료 생성 (배포물에 포함하지 않음)
import { mkdirSync, writeFileSync } from 'node:fs';
import osmtogeojson from 'osmtogeojson';
import { processOsm, type GeoCollection } from '../src/lib/osmProcess';
import { makeOsm, FIXTURE_CENTER } from './fixtures/makeOsm';

const out = process.argv[2] ?? 'dist/data';
mkdirSync(out, { recursive: true });
const d = processOsm(osmtogeojson(makeOsm(), { flatProperties: true }) as GeoCollection, {
  day: 1,
  masks: [{ center: FIXTURE_CENTER, r: 300 }],
  generatedAt: 'browser-test',
});
writeFileSync(`${out}/day-1.json`, JSON.stringify(d));
writeFileSync(`${out}/day-3.json`, '{"broken": tru'); // 오류 처리 확인용
console.log('fixture', d.stats);
