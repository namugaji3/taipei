import type { DayDetail } from './detailTypes';

export type DetailResult =
  | { status: 'ok'; data: DayDetail }
  | { status: 'missing' }
  | { status: 'error'; message: string };

function isDayDetail(v: unknown): v is DayDetail {
  const d = v as DayDetail;
  return (
    !!d &&
    d.version === 1 &&
    Array.isArray(d.buildings) &&
    Array.isArray(d.trees) &&
    Array.isArray(d.masks) &&
    Array.isArray(d.origin)
  );
}

/** public/data/day-N.json을 불러옵니다. signal이 취소되면 AbortError를 던집니다. */
export async function loadDayDetail(day: number, signal: AbortSignal): Promise<DetailResult> {
  const url = `${import.meta.env.BASE_URL}data/day-${day}.json`;
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: 'force-cache' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { status: 'error', message: '네트워크 연결을 확인해 주세요.' };
  }
  if (res.status === 404) return { status: 'missing' };
  if (!res.ok) return { status: 'error', message: `서버 응답 ${res.status}` };
  // 정적 호스팅에서 없는 파일을 index.html로 돌려주는 경우도 "없음"으로 처리
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('text/html')) return { status: 'missing' };
  try {
    const json: unknown = await res.json();
    if (!isDayDetail(json)) return { status: 'error', message: '자료 형식이 올바르지 않습니다.' };
    return { status: 'ok', data: json };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { status: 'error', message: '자료를 읽지 못했습니다.' };
  }
}
