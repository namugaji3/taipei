import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Day, Place } from '../data/itinerary';
import type { DayDetail } from '../lib/detailTypes';
import { loadDayDetail } from '../lib/loadDetail';
import { DetailLayer, DETAIL_LAYER_ID } from './DetailLayer';
import { BaseBuildingMask } from './baseBuildings';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** 기본 지도 스타일을 불러오지 못했을 때 쓰는 최소 스타일 */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe4dc' } }],
};

export type DetailStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: DayDetail }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

export type BaseStatus = 'loading' | 'ok' | 'fallback' | 'tile-error';

interface Props {
  day: Day;
  places: Place[];
  selectedId: string;
  is3D: boolean;
  orbiting: boolean;
  reducedMotion: boolean;
  overviewToken: number;
  onSelect: (id: string) => void;
  onOrbitStop: () => void;
  onDetail: (s: DetailStatus) => void;
  onBase: (s: BaseStatus) => void;
  retryToken: number;
  baseRetryToken: number;
}

const PITCH_3D = 58;

export function MapView(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const layerRef = useRef<DetailLayer | null>(null);
  const maskRef = useRef<BaseBuildingMask | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>>(new Map());
  const [styleReady, setStyleReady] = useState(0);
  const propsRef = useRef(p);
  propsRef.current = p;
  const detailRef = useRef<DayDetail | null>(null);

  // ── 지도 생성 ──
  useEffect(() => {
    if (!box.current) return;
    const first = propsRef.current.places[0];
    const map = new maplibregl.Map({
      container: box.current,
      style: STYLE_URL,
      center: [first.lng, first.lat],
      zoom: first.zoom - 0.6,
      pitch: propsRef.current.is3D ? PITCH_3D : 0,
      bearing: -18,
      maxPitch: 75,
      canvasContextAttributes: { antialias: true },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;
    // 검증용: ?debug 주소에서만 콘솔에 지도 객체를 노출합니다.
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __map: MLMap; __layer: () => DetailLayer | null }).__map = map;
      (window as unknown as { __layer: () => DetailLayer | null }).__layer = () => layerRef.current;
    }
    maskRef.current = new BaseBuildingMask(map);

    let loaded = false;
    let fellBack = false;
    const fallback = () => {
      if (loaded || fellBack) return;
      fellBack = true;
      propsRef.current.onBase('fallback');
      map.setStyle(FALLBACK_STYLE);
    };
    const timer = window.setTimeout(fallback, 15000);
    map.on('error', (e) => {
      // 스타일 자체를 받지 못한 경우에만 대체 스타일로 전환합니다.
      if (!map.isStyleLoaded() && !loaded) fallback();
      else if ((e as { sourceId?: string }).sourceId && !fellBack) propsRef.current.onBase('tile-error');
    });
    map.on('style.load', () => {
      window.clearTimeout(timer);
      if (!fellBack) {
        loaded = true;
        propsRef.current.onBase('ok');
      }
      setupStyle(map);
      setStyleReady((n) => n + 1);
    });

    // 사용자가 직접 조작하면 자동 회전을 멈춥니다.
    const stop = () => propsRef.current.orbiting && propsRef.current.onOrbitStop();
    const canvas = map.getCanvasContainer();
    canvas.addEventListener('pointerdown', stop);
    canvas.addEventListener('wheel', stop, { passive: true });
    canvas.addEventListener('keydown', stop);
    canvas.addEventListener('touchstart', stop, { passive: true });

    return () => {
      window.clearTimeout(timer);
      maskRef.current?.detach();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── 기본 지도 다시 시도 ──
  useEffect(() => {
    if (!p.baseRetryToken || !mapRef.current) return;
    propsRef.current.onBase('loading');
    mapRef.current.setStyle(STYLE_URL);
  }, [p.baseRetryToken]);

  function setupStyle(map: MLMap) {
    // 동선 점선
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: routeGeoJSON(propsRef.current.places) });
    }
    if (!map.getLayer('route-casing')) {
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f6f7f2', 'line-width': 6, 'line-opacity': 0.85 },
      });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#9a6b1c', 'line-width': 3, 'line-dasharray': [1.4, 1.6] },
      });
    }
    // 상세 건물 레이어 (라벨 아래)
    const labelLayer = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
    if (!layerRef.current) layerRef.current = new DetailLayer();
    if (!map.getLayer(DETAIL_LAYER_ID)) map.addLayer(layerRef.current, labelLayer);
    layerRef.current.setVisible(propsRef.current.is3D);
    if (detailRef.current) layerRef.current.setData(detailRef.current);
    maskRef.current?.attach();
    maskRef.current?.set3D(propsRef.current.is3D);
    maskRef.current?.setMasks(detailRef.current?.masks ?? []);
  }

  // ── 날짜별 상세 자료 (이전 요청 취소) ──
  useEffect(() => {
    const ctrl = new AbortController();
    detailRef.current = null;
    layerRef.current?.setData(null);
    maskRef.current?.setMasks([]);
    p.onDetail({ kind: 'loading' });
    loadDayDetail(p.day.id, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return;
        if (r.status === 'ok') {
          detailRef.current = r.data;
          try {
            layerRef.current?.setData(r.data);
            maskRef.current?.setMasks(r.data.masks);
            const sel = propsRef.current.places.find((x) => x.id === propsRef.current.selectedId);
            if (sel) layerRef.current?.setFocus(sel.lng, sel.lat);
            p.onDetail({ kind: 'ok', data: r.data });
          } catch (e) {
            // 그리기 실패 시에도 기본 지도는 유지합니다.
            detailRef.current = null;
            layerRef.current?.setData(null);
            maskRef.current?.setMasks([]);
            p.onDetail({ kind: 'error', message: '상세 건물을 그리지 못했습니다.' });
            console.error(e);
          }
        } else if (r.status === 'missing') p.onDetail({ kind: 'missing' });
        else p.onDetail({ kind: 'error', message: r.message });
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') p.onDetail({ kind: 'error', message: '알 수 없는 오류' });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.day.id, p.retryToken]);

  // ── 마커·동선 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    src?.setData(routeGeoJSON(p.places));

    for (const { marker } of markersRef.current.values()) marker.remove();
    markersRef.current.clear();
    p.places.forEach((pl, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'marker';
      el.dataset.kind = pl.kind;
      el.setAttribute('aria-label', `${i + 1}번 ${pl.name} 선택`);
      el.innerHTML = `<span class="marker-num">${i + 1}</span><span class="marker-name"></span>`;
      (el.querySelector('.marker-name') as HTMLElement).textContent = pl.name;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        propsRef.current.onSelect(pl.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pl.lng, pl.lat]).addTo(map);
      markersRef.current.set(pl.id, { marker, el });
    });
    markersRef.current.get(p.selectedId)?.el.classList.add('is-active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.places, styleReady]);

  // ── 선택 장소로 카메라 이동 ──
  useEffect(() => {
    const map = mapRef.current;
    const pl = p.places.find((x) => x.id === p.selectedId);
    if (!map || !pl) return;
    for (const [id, { el }] of markersRef.current) {
      el.classList.toggle('is-active', id === p.selectedId);
      el.setAttribute('aria-pressed', String(id === p.selectedId));
    }
    layerRef.current?.setFocus(pl.lng, pl.lat);
    const cam = {
      center: [pl.lng, pl.lat] as [number, number],
      zoom: pl.zoom,
      pitch: p.is3D ? PITCH_3D : 0,
      bearing: p.is3D ? map.getBearing() : 0,
    };
    if (p.reducedMotion) map.jumpTo(cam);
    else map.flyTo({ ...cam, duration: 1700, essential: false, curve: 1.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedId, p.places]);

  // ── 오늘 동선 전체 보기 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !p.overviewToken) return;
    const b = new maplibregl.LngLatBounds();
    p.places.forEach((pl) => b.extend([pl.lng, pl.lat]));
    const narrow = (box.current?.clientWidth ?? 800) < 560;
    map.fitBounds(b, {
      padding: narrow ? 48 : 90,
      pitch: p.is3D ? 40 : 0,
      bearing: p.is3D ? map.getBearing() : 0,
      duration: p.reducedMotion ? 0 : 1400,
      maxZoom: 16,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.overviewToken]);

  // ── 2D/3D ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.setVisible(p.is3D);
    maskRef.current?.set3D(p.is3D);
    if (p.is3D) {
      map.dragRotate.enable();
      map.touchPitch.enable();
      map.easeTo({ pitch: PITCH_3D, duration: p.reducedMotion ? 0 : 700 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: p.reducedMotion ? 0 : 700 });
      map.touchPitch.disable();
    }
  }, [p.is3D, p.reducedMotion]);

  // ── 둘러보기(자동 회전) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !p.orbiting || p.reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!map.isMoving()) map.setBearing(map.getBearing() + dt * 0.006);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [p.orbiting, p.reducedMotion]);

  return <div ref={box} className="map-canvas" role="region" aria-label="타이베이 3D 지도" />;
}

function routeGeoJSON(places: Place[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: places.map((p) => [p.lng, p.lat]) },
  };
}
