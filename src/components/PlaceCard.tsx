import { WEEKDAY_KO, type Place } from '../data/itinerary';

const BOOKING: Record<Place['booking'], string> = {
  none: '예약 필요 없음',
  recommended: '예약 권장 · 미예약',
  'online-sales': '일부 체험 별도 판매 · 미예약',
};

const KIND: Record<Place['kind'], string> = { sight: '관람', food: '식사', rest: '휴식' };

export function PlaceCard({
  place,
  index,
  active,
  date,
  onSelect,
}: {
  place: Place & { corrected?: number };
  index: number;
  active: boolean;
  date: Date | null;
  onSelect: (id: string) => void;
}) {
  const closed = date && place.closedDays?.includes(date.getDay());
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=transit`;
  const pano = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${place.lat},${place.lng}`;
  return (
    <li
      className={`card ${active ? 'is-active' : ''}`}
      data-place={place.id}
      data-kind={place.kind}
      onClick={() => onSelect(place.id)}
    >
      <div className="card-rail" aria-hidden="true">
        <span className="card-num">{index + 1}</span>
      </div>
      <div className="card-body">
        <button
          type="button"
          className="card-select"
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(place.id);
          }}
        >
          <span className="card-time">
            <time>{place.time}</time> <span className="card-kind">{KIND[place.kind]}</span>
          </span>
          <span className="card-name">{place.name}</span>
          <span className="card-local" lang="zh-Hant">
            {place.local}
          </span>
        </button>
        <p className="card-desc">{place.desc}</p>
        <dl className="card-facts">
          <div>
            <dt>운영</dt>
            <dd>
              {place.hours.text}{' '}
              {place.hours.verified ? (
                <span className="tag is-ok">
                  {place.hours.source ? (
                    <a href={place.hours.source.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      공식 자료 확인
                    </a>
                  ) : (
                    '공식 자료 확인'
                  )}
                </span>
              ) : (
                <span className="tag is-check">확인 필요</span>
              )}
            </dd>
          </div>
          <div>
            <dt>예약</dt>
            <dd>
              {BOOKING[place.booking]}
              {place.bookingNote && <span className="card-note"> {place.bookingNote}</span>}
            </dd>
          </div>
        </dl>
        {closed && (
          <p className="alert">
            {WEEKDAY_KO[date!.getDay()]}요일 정기 휴관입니다. 다른 날로 옮기세요.
          </p>
        )}
        {place.corrected !== undefined && (
          <p className="fine">좌표를 OSM 기록 위치로 {Math.round(place.corrected)}m 보정했습니다.</p>
        )}
        <p className="card-links">
          <a href={dir} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            Google 지도 길찾기
          </a>
          <a href={pano} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            거리 사진 보기
          </a>
        </p>
      </div>
    </li>
  );
}
