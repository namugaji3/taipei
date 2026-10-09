// 기본 지도(OpenFreeMap) 입체 건물과 상세 건물의 이중 표시를 막습니다.
//
// 상세 자료 범위(장소별 반경) 안의 기본 지도 건물만 높이를 0으로 낮춥니다.
// - 기본 지도 건물 타일에 id가 있으면 feature-state로 개별 처리합니다.
// - id가 없으면 상세 범위가 화면에 있을 때 기본 입체 건물 레이어를 숨기고
//   평면 건물(footprint)만 남깁니다. 어느 쪽이든 건물 윤곽 자체는 지우지 않습니다.
import type { Map as MLMap, ExpressionSpecification } from 'maplibre-gl';
import type { DetailMask } from '../lib/detailTypes';
import { interiorPoint, metersBetween } from '../lib/osmProcess';

interface ExtrusionLayerInfo {
  id: string;
  source: string;
  sourceLayer: string;
}

export class BaseBuildingMask {
  private layers: ExtrusionLayerInfo[] = [];
  private hidden = new Map<string, Set<string | number>>();
  private masks: DetailMask[] = [];
  private mode: 'state' | 'layer' | 'none' = 'none';
  private pending = false;
  private enabled3D = true;

  constructor(private map: MLMap) {}

  /** 스타일이 로드될 때마다 호출 */
  attach() {
    this.layers = [];
    this.hidden.clear();
    const style = this.map.getStyle();
    for (const l of style.layers ?? []) {
      if (l.type !== 'fill-extrusion') continue;
      const src = (l as { source?: string }).source;
      const sl = (l as { 'source-layer'?: string })['source-layer'];
      if (!src || !sl) continue;
      this.layers.push({ id: l.id, source: src, sourceLayer: sl });
      const h = this.map.getPaintProperty(l.id, 'fill-extrusion-height') as ExpressionSpecification | number | undefined;
      const b = this.map.getPaintProperty(l.id, 'fill-extrusion-base') as ExpressionSpecification | number | undefined;
      const wrap = (v: ExpressionSpecification | number | undefined): ExpressionSpecification => [
        'case',
        ['boolean', ['feature-state', 'covered'], false],
        0,
        (v ?? 0) as ExpressionSpecification,
      ];
      try {
        this.map.setPaintProperty(l.id, 'fill-extrusion-height', wrap(h));
        this.map.setPaintProperty(l.id, 'fill-extrusion-base', wrap(b));
      } catch {
        /* 지원하지 않는 스타일이면 레이어 모드로 처리 */
      }
    }
    this.map.off('sourcedata', this.onSourceData);
    this.map.off('moveend', this.onSourceData);
    this.map.on('sourcedata', this.onSourceData);
    this.map.on('moveend', this.onSourceData);
  }

  get extrusionLayerIds(): string[] {
    return this.layers.map((l) => l.id);
  }

  set3D(on: boolean) {
    this.enabled3D = on;
    this.apply();
  }

  setMasks(masks: DetailMask[]) {
    this.masks = masks;
    this.apply();
  }

  private onSourceData = () => {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.apply();
    });
  };

  private apply() {
    if (!this.layers.length) return;
    // 2D 모드에서는 기본 입체 건물도 숨깁니다.
    if (!this.enabled3D) {
      this.setLayerVisibility(false);
      return;
    }
    if (!this.masks.length) {
      this.clearStates();
      this.setLayerVisibility(true);
      return;
    }
    for (const layer of this.layers) {
      let feats;
      try {
        feats = this.map.querySourceFeatures(layer.source, { sourceLayer: layer.sourceLayer });
      } catch {
        continue;
      }
      if (!feats.length) continue;
      const withId = feats.filter((f) => f.id !== undefined && f.id !== null);
      if (withId.length < feats.length * 0.9) {
        this.mode = 'layer';
        continue;
      }
      this.mode = 'state';
      const key = layer.source + '/' + layer.sourceLayer;
      const set = this.hidden.get(key) ?? new Set();
      const next = new Set<string | number>();
      for (const f of withId) {
        if (this.covered(f.geometry)) next.add(f.id as string | number);
      }
      for (const id of set)
        if (!next.has(id))
          this.map.setFeatureState({ source: layer.source, sourceLayer: layer.sourceLayer, id }, { covered: false });
      for (const id of next)
        if (!set.has(id))
          this.map.setFeatureState({ source: layer.source, sourceLayer: layer.sourceLayer, id }, { covered: true });
      this.hidden.set(key, next);
    }
    if (this.mode === 'layer') {
      // id가 없는 타일: 상세 범위가 보이는 동안 기본 입체 건물을 숨깁니다.
      const b = this.map.getBounds();
      const visible = this.masks.some((m) => b.contains(m.center as [number, number]));
      this.setLayerVisibility(!visible);
    } else this.setLayerVisibility(true);
  }

  get strategy() {
    return this.mode;
  }

  private covered(g: GeoJSON.Geometry): boolean {
    // 상세 자료와 같은 규칙(건물 대표점이 반경 안)으로 판정해 빈틈과 중복을 함께 줄입니다.
    const polys: number[][][][] =
      g.type === 'Polygon'
        ? [g.coordinates as number[][][]]
        : g.type === 'MultiPolygon'
          ? (g.coordinates as number[][][][])
          : [];
    for (const poly of polys) {
      const rings = poly.map((r) => r.map((c) => [c[0], c[1]] as [number, number]));
      if (!rings[0] || rings[0].length < 3) continue;
      const p = interiorPoint(rings[0], rings.slice(1));
      if (this.masks.some((m) => metersBetween(p, m.center) <= m.r + 3)) return true;
    }
    return false;
  }

  private clearStates() {
    for (const layer of this.layers) {
      try {
        this.map.removeFeatureState({ source: layer.source, sourceLayer: layer.sourceLayer });
      } catch {
        /* ignore */
      }
    }
    this.hidden.clear();
  }

  private setLayerVisibility(v: boolean) {
    for (const l of this.layers) {
      if (!this.map.getLayer(l.id)) continue;
      const cur = this.map.getLayoutProperty(l.id, 'visibility') ?? 'visible';
      const want = v ? 'visible' : 'none';
      if (cur !== want) this.map.setLayoutProperty(l.id, 'visibility', want);
    }
  }

  detach() {
    this.map.off('sourcedata', this.onSourceData);
    this.map.off('moveend', this.onSourceData);
  }
}
