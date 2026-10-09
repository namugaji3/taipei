import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DAYS, HOLIDAYS_2027, HOLIDAY_SOURCE, TRIP, WEEKDAY_KO, type Place } from './data/itinerary';
import { CITY_PHOTO } from './data/photos';
import { MapView, type BaseStatus, type DetailStatus } from './map/MapView';
import { PlaceCard } from './components/PlaceCard';
import { usePrefersReducedMotion } from './lib/useMedia';

function addDays(iso: string, n: number): Date {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d;
}
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function App() {
  const [dayId, setDayId] = useState(1);
  const day = DAYS.find((d) => d.id === dayId)!;
  const [selectedId, setSelectedId] = useState(day.places[0].id);
  const [is3D, setIs3D] = useState(true);
  const [orbiting, setOrbiting] = useState(false);
  const [overviewToken, setOverviewToken] = useState(0);
  const [detail, setDetail] = useState<DetailStatus>({ kind: 'idle' });
  const [base, setBase] = useState<BaseStatus>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [baseRetryToken, setBaseRetryToken] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [daysOpen, setDaysOpen] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const cardsRef = useRef<HTMLOListElement>(null);

  // OSM 이름 대조 결과로 좌표 보정 (자료가 있는 날짜만)
  const places: Place[] = useMemo(() => {
    if (detail.kind !== 'ok' || detail.data.day !== dayId) return day.places;
    const checks = detail.data.placeChecks ?? [];
    return day.places.map((pl) => {
      const c = checks.find((x) => x.id === pl.id);
      if (c?.osm && c.offsetM !== undefined && c.offsetM > 25 && c.offsetM < 600) {
        return { ...pl, lng: c.osm[0], lat: c.osm[1], corrected: c.offsetM } as Place & { corrected: number };
      }
      return pl;
    });
  }, [day, dayId, detail]);

  const selectDay = useCallback(
    (id: number) => {
      if (id === dayId) return;
      setDayId(id);
      setSelectedId(DAYS.find((d) => d.id === id)!.places[0].id);
      setOrbiting(false);
      setDaysOpen(false);
    },
    [dayId],
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setOrbiting(false);
  }, []);

  // 마커로 선택하면 해당 카드가 보이도록
  useEffect(() => {
    const el = cardsRef.current?.querySelector<HTMLElement>(`[data-place="${selectedId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [selectedId, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) setOrbiting(false);
  }, [reducedMotion]);

  const dateOf = (i: number) => (startDate ? addDays(startDate, i) : null);
  const thisDate = dateOf(dayId - 1);
  const holidayOn = (d: Date | null) => {
    if (!d) return undefined;
    const iso = isoOf(d);
    return HOLIDAYS_2027.find((h) => iso >= h.from && iso <= h.to);
  };
  const holiday = holidayOn(thisDate);
  const selected = places.find((x) => x.id === selectedId) ?? places[0];

  return (
    <div className="app">
      <aside className="brand" aria-label="여행 개요">
        <header className="brand-head">
          <h1 className="title-en" lang="en">
            {TRIP.title}
          </h1>
          <p className="title-ko">{TRIP.subtitle}</p>
          <p className="period">{startDate ? `${startDate} 출발 · 4박 5일` : TRIP.period}</p>
          <label className="date-field">
            <span>출발일</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-describedby="date-help"
            />
          </label>
          <p id="date-help" className="fine">
            날짜를 넣으면 요일별 휴관을 확인해 드립니다.
          </p>
        </header>

        <figure className="city-photo">
          {photoOk ? (
            <img
              src={CITY_PHOTO.src}
              alt={CITY_PHOTO.alt}
              width={900}
              height={600}
              loading="eager"
              onError={() => setPhotoOk(false)}
            />
          ) : (
            <div className="photo-missing" role="img" aria-label="사진을 불러오지 못했습니다">
              <span>사진을 불러오지 못했습니다</span>
              <a href={CITY_PHOTO.page} target="_blank" rel="noreferrer">
                원본 페이지에서 보기
              </a>
            </div>
          )}
          <figcaption>
            {CITY_PHOTO.caption} ·{' '}
            <a href={CITY_PHOTO.page} target="_blank" rel="noreferrer">
              {CITY_PHOTO.author}
            </a>
            , {CITY_PHOTO.license}
          </figcaption>
        </figure>

        <nav className="days" aria-label="날짜 선택">
          <button
            type="button"
            className="days-toggle"
            aria-expanded={daysOpen}
            aria-controls="day-list"
            onClick={() => setDaysOpen((v) => !v)}
          >
            <span>
              {dayId}일차 · {day.title}
            </span>
            <span aria-hidden="true">{daysOpen ? '접기' : '날짜 바꾸기'}</span>
          </button>
          <ol id="day-list" className={`day-list ${daysOpen ? 'is-open' : ''}`}>
            {DAYS.map((d, i) => {
              const date = dateOf(i);
              const closes = date
                ? d.places.filter((pl) => pl.closedDays?.includes(date.getDay())).length
                : 0;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={`ticket ${d.id === dayId ? 'is-active' : ''}`}
                    aria-current={d.id === dayId ? 'true' : undefined}
                    onClick={() => selectDay(d.id)}
                  >
                    <span className="ticket-day" lang="en">
                      Day {d.id}
                    </span>
                    <span className="ticket-title">{d.title}</span>
                    <span className="ticket-meta">
                      {date ? `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAY_KO[date.getDay()]})` : d.area}
                      {closes > 0 && <em className="ticket-warn">휴관 {closes}곳</em>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>

      <main className="stage">
        <header className="day-head">
          <p className="day-area">
            {dayId}일차 · {day.area}
            {thisDate && ` · ${thisDate.getMonth() + 1}월 ${thisDate.getDate()}일 ${WEEKDAY_KO[thisDate.getDay()]}요일`}
          </p>
          <h2 className="day-title">{day.title}</h2>
          <p className="day-summary">{day.summary}</p>
          {holiday && (
            <p className="alert">
              이날은 대만 공휴일({holiday.name})입니다. 박물관 휴관·혼잡 여부를 다시 확인하세요.
            </p>
          )}
        </header>

        <div className="map-toolbar" role="toolbar" aria-label="지도 조작">
          <button type="button" onClick={() => { setOrbiting(false); setOverviewToken((n) => n + 1); }}>
            오늘 동선
          </button>
          <button type="button" aria-pressed={is3D} onClick={() => { setIs3D((v) => !v); setOrbiting(false); }}>
            {is3D ? '2D로 보기' : '3D로 보기'}
          </button>
          <button
            type="button"
            aria-pressed={orbiting}
            disabled={reducedMotion || !is3D}
            title={reducedMotion ? '움직임 줄이기 설정이 켜져 있어 자동 회전을 쓰지 않습니다' : undefined}
            onClick={() => setOrbiting((v) => !v)}
          >
            {orbiting ? '멈추기' : '둘러보기'}
          </button>
          <span className="toolbar-place" aria-live="polite">
            {places.indexOf(selected) + 1}. {selected.name}
          </span>
        </div>

        <div className="map-frame">
          <MapView
            day={day}
            places={places}
            selectedId={selectedId}
            is3D={is3D}
            orbiting={orbiting}
            reducedMotion={reducedMotion}
            overviewToken={overviewToken}
            onSelect={select}
            onOrbitStop={() => setOrbiting(false)}
            onDetail={setDetail}
            onBase={setBase}
            retryToken={retryToken}
            baseRetryToken={baseRetryToken}
          />
        </div>

        <div className="map-status" aria-live="polite">
          <StatusLine detail={detail} base={base} onRetry={() => setRetryToken((n) => n + 1)} onBaseRetry={() => setBaseRetryToken((n) => n + 1)} />
          <p className="fine">
            점선은 방문 순서를 잇는 선이며 실제 길찾기 경로가 아닙니다. 이동은 아래 ‘이동 방법’과 각 장소의 길찾기 링크를 이용하세요.
          </p>
        </div>
      </main>

      <section className="stops" aria-label="방문 장소">
        <h2 className="stops-title">시간순 방문 장소</h2>
        <ol className="cards" ref={cardsRef}>
          {places.map((pl, i) => (
            <PlaceCard
              key={pl.id}
              place={pl}
              index={i}
              active={pl.id === selectedId}
              date={thisDate}
              onSelect={select}
            />
          ))}
        </ol>
      </section>

      <section className="notes" aria-label="여행 안내">
        <article>
          <h3>이동 방법</h3>
          <p>{day.move}</p>
        </article>
        <article>
          <h3>먹거리</h3>
          <p>{day.eat}</p>
        </article>
        <article>
          <h3>예약 안내</h3>
          <p>{day.reserve}</p>
          <p className="fine">이 페이지의 어떤 일정도 예약된 상태가 아닙니다.</p>
        </article>
        <article>
          <h3>비 오는 날 대안</h3>
          <p>{day.rain}</p>
        </article>
      </section>

      <footer className="credits">
        <h3>출처와 이용 조건</h3>
        <ul>
          <li>
            지도 자료 ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap 기여자
            </a>{' '}
            (ODbL 1.0). 상세 건물·나무는 OSM 자료를 날짜별로 미리 추출해 사용합니다.
          </li>
          <li>
            기본 지도 타일:{' '}
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
              OpenFreeMap
            </a>{' '}
            ·{' '}
            <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">
              © OpenMapTiles
            </a>
          </li>
          <li>
            사진: {CITY_PHOTO.author}, «{CITY_PHOTO.caption}», {CITY_PHOTO.license} ·{' '}
            <a href={CITY_PHOTO.page} target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>
          </li>
          <li>
            공휴일: <a href={HOLIDAY_SOURCE.url} target="_blank" rel="noreferrer">{HOLIDAY_SOURCE.label}</a>. 2026년 남은 공휴일과
            2027년 전체 목록은 행정원 인사행정총처 발표를 직접 확인하세요.
          </li>
          <li>
            3D 표현 안내: 실사 3D가 아닌, OSM 윤곽·높이·지붕 기록으로 만든 입체 지도입니다. 창문은 층 높이 3.2m 기준의 반복
            무늬로 실제 창 위치와 다릅니다. 높이 기록이 없는 건물은 층수 또는 3층 기준으로 추정했습니다.
          </li>
        </ul>
      </footer>
    </div>
  );
}

function StatusLine({
  detail,
  base,
  onRetry,
  onBaseRetry,
}: {
  detail: DetailStatus;
  base: BaseStatus;
  onRetry: () => void;
  onBaseRetry: () => void;
}) {
  return (
    <div className="status">
      {base === 'fallback' && (
        <p className="status-item is-warn">
          기본 지도 타일을 불러오지 못해 배경만 표시 중입니다.{' '}
          <button type="button" className="link-btn" onClick={onBaseRetry}>
            지도 다시 불러오기
          </button>
        </p>
      )}
      {base === 'tile-error' && (
        <p className="status-item is-warn">
          기본 지도 일부를 불러오지 못했습니다.{' '}
          <button type="button" className="link-btn" onClick={onBaseRetry}>
            지도 다시 불러오기
          </button>
        </p>
      )}
      {detail.kind === 'loading' && <p className="status-item">상세 건물과 가로수를 불러오는 중…</p>}
      {detail.kind === 'missing' && (
        <p className="status-item">이 날짜는 상세 3D 자료가 없어 기본 지도의 건물로 표시합니다.</p>
      )}
      {detail.kind === 'error' && (
        <p className="status-item is-warn">
          상세 3D 자료를 불러오지 못했습니다({detail.message}). 기본 지도는 그대로 쓸 수 있습니다.{' '}
          <button type="button" className="link-btn" onClick={onRetry}>
            다시 시도
          </button>
        </p>
      )}
      {detail.kind === 'ok' && (
        <p className="status-item">
          OSM 건물 {detail.data.stats.buildings + detail.data.stats.parts}개(부분 {detail.data.stats.parts}) · 중정{' '}
          {detail.data.stats.courtyards}곳 · 나무 {detail.data.stats.trees}그루. 높이 추정{' '}
          {Math.round(
            (detail.data.stats.estimatedHeights / Math.max(1, detail.data.buildings.length)) * 100,
          )}
          %, 경사·돔 지붕은 형태를 단순화한 근사입니다.
        </p>
      )}
    </div>
  );
}
