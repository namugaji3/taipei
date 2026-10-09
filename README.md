# Taipei · 다섯 날의 골목 수첩

타이베이 5일 일정을 OpenStreetMap의 실제 건물 윤곽·건물 부분·높이·지붕 기록과 가로수 위치로 만든 3D 지도에서 둘러보는 웹페이지입니다.
React + TypeScript + MapLibre GL JS를 쓰며, 상세 건물과 나무는 three.js 사용자 정의 레이어로 그립니다.

## 웹에 바로 공개하기 (설치 없이)

1. GitHub에서 새 저장소를 만듭니다 (공개 저장소).
2. 이 폴더의 파일 전체를 저장소에 업로드합니다. 숨김 폴더 `.github`도 함께 올려야 합니다.
3. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
4. **Actions** 탭에서 「웹페이지 배포」를 실행합니다(업로드 직후 자동 실행되었다면 다시 실행).
5. 5–10분 뒤 `https://<계정>.github.io/<저장소>/` 주소로 열립니다.

배포 과정에서 OSM 자료를 자동으로 수집하므로 내 컴퓨터에 아무것도 설치할 필요가 없습니다.

## 내 컴퓨터에서 실행

```bash
npm install
npm run data      # OSM 상세 자료 생성 (최초 1회, 5일 기준 수 분 소요)
npm run dev       # 개발 서버
npm run build     # 타입 검사 + 배포용 빌드 (dist/)
npm test          # OSM 변환 단위 테스트
```

- `npm run data -- 3`처럼 날짜를 지정할 수 있습니다.
- 공개 Overpass 서버가 혼잡하면: `OVERPASS_URL=https://overpass.kumi.systems/api/interpreter npm run data`
- 스크립트는 각 장소 좌표를 OSM 이름과 대조한 결과를 출력합니다. "이름 일치 없음"인 장소는 `src/data/itinerary.ts` 좌표를 직접 확인하세요. 오차가 25–600m이면 앱이 OSM 좌표로 자동 보정하고 카드에 표시합니다.
- `dist/`는 정적 호스팅 어디에나 올릴 수 있습니다(`base: './'`). 자료 파일은 `dist/data/`로 함께 복사됩니다.

## 동작 방식

| 항목 | 내용 |
|---|---|
| 기본 지도 | OpenFreeMap(키 불필요). 불러오지 못하면 배경 지도로 전환하고 다시 시도 버튼 표시 |
| 상세 자료 | `public/data/day-N.json`. 날짜 변경 시 이전 요청 취소, 파일이 없거나 깨지면 기본 지도 유지 + 안내 |
| 중복 방지 | 상세 범위 안의 기본 지도 입체 건물만 feature-state로 높이 0 처리. 타일에 id가 없으면 범위가 보이는 동안 기본 입체 레이어 숨김 |
| 지붕 | roof:shape 기반 근사(박공·모임·피라미드·돔·양파·원뿔·외쪽·반원통). 중정 있는 건물의 경사 지붕은 평지붕 |
| 추정 | 높이 기록 없으면 층수×3.2m, 층수도 없으면 3층(주택류 2층). 창문은 층 높이 기준 반복 무늬이며 실제 창 위치 아님 |
| 나무 | natural=tree, tree_row(8m 간격). 야자(속명·종명), 침엽(leaf_type), 그 외 활엽. 크기 기록 없으면 일정 범위로 추정 |

주소에 `?debug`를 붙이면 콘솔에서 `__map`, `__layer()`로 검증할 수 있습니다.

## 출처와 이용 조건

- 지도 자료 © OpenStreetMap contributors, ODbL 1.0 / 타일 OpenFreeMap, © OpenMapTiles
- 사진: CEphoto, Uwe Aranas, CC BY-SA 3.0 (Wikimedia Commons)
- 운영 정보는 공식 자료로 확인한 항목만 "공식 자료 확인", 나머지는 "확인 필요"로 표시
- 이 일정의 어떤 항목도 예약되어 있지 않습니다.
