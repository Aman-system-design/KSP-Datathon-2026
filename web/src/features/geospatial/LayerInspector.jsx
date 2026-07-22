import { useEffect, useId, useMemo, useRef, useState } from 'react';

const RENDERERS = Object.freeze({
  POINT: ['POINT', 'CLUSTER', 'HEATMAP'], MULTI_POINT: ['POINT', 'CLUSTER', 'HEATMAP'],
  H3: ['H3', 'CHOROPLETH'], POLYGON: ['CHOROPLETH'], MULTI_POLYGON: ['CHOROPLETH'],
  ADMIN_BOUNDARY: ['CHOROPLETH'],
});

function safeValue(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value !== 'object') return String(value);
  try { return JSON.stringify(value); } catch { return 'Unavailable'; }
}

function Row({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export function LayerInspector({ layer, timeWindow, onApply, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const options = useMemo(() => RENDERERS[layer?.dataset?.geometryType] ?? [], [layer]);
  const [renderer, setRenderer] = useState(layer?.renderer ?? '');
  useEffect(() => setRenderer(layer?.renderer ?? ''), [layer?.id, layer?.renderer]);
  useEffect(() => {
    closeButtonRef.current?.focus();
    return () => { returnFocusRef.current?.focus?.(); };
  }, []);
  if (!layer) return null;
  const valid = options.includes(renderer);
  const closeOnEscape = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
  };
  return <aside
    className="geospatial-panel geospatial-inspector" role="dialog" aria-modal="false"
    aria-labelledby={titleId} onKeyDown={closeOnEscape}
  >
    <header className="geospatial-drawer-heading">
      <div><span>Layer inspector</span><h2 id={titleId}>Configure {layer.name}</h2></div>
      <button ref={closeButtonRef} type="button" aria-label="Close layer inspector" onClick={onClose}>Close</button>
    </header>
    <section><h3>Data</h3><dl>
      <Row label="Source dataset">{safeValue(layer.dataset?.name ?? layer.datasetId)}</Row>
      <Row label="Provenance">{safeValue(layer.dataset?.provenance)}</Row>
      <Row label="Owner">{safeValue(layer.dataset?.owner)}</Row>
      <Row label="Freshness">{layer.state === 'STALE' ? 'STALE — last verified output retained' : layer.state}</Row>
      <Row label="Published at">{safeValue(layer.meta?.publishedAt)}</Row>
      <Row label="Record count">{safeValue(layer.meta?.outputFeatureCount ?? layer.featureCollection?.features?.length)}</Row>
      <Row label="Sensitivity">{safeValue(layer.dataset?.sensitivity)}</Row>
    </dl></section>
    <section><h3>Geometry</h3><dl>
      <Row label="Geometry type">{safeValue(layer.dataset?.geometryType)}</Row>
      <Row label="Mapping">{safeValue(layer.dataset?.geometry)}</Row>
      <Row label="Missing fields">{safeValue(layer.dataset?.missingRequiredFields)}</Row>
    </dl></section>
    {layer.spatialStatus === 'AVAILABLE' ? <form onSubmit={event => {
      event.preventDefault();
      if (valid) onApply(layer.id, { renderer });
    }}>
      <section><h3>Visual</h3><label>Renderer<select aria-label="Renderer" value={renderer} onChange={event => setRenderer(event.target.value)}>
        {options.map(option => <option key={option}>{option}</option>)}
      </select></label><dl>
        <Row label="Weight field">{safeValue(layer.weightField)}</Row>
        <Row label="Color field">{safeValue(layer.colorField)}</Row>
        <Row label="Size field">{safeValue(layer.sizeField)}</Row>
      </dl></section>
      <section><h3>Interaction</h3><dl>
        <Row label="Tooltip fields">{safeValue(layer.tooltipFields)}</Row>
        <Row label="Filter">{safeValue(layer.filter)}</Row>
        <Row label="Time window">{safeValue(timeWindow)}</Row>
        <Row label="Legend">{safeValue(layer.legend)}</Row>
        <Row label="Click drilldown">{safeValue(layer.clickDrilldown)}</Row>
      </dl></section>
      <button className="primary-button" type="submit" disabled={!valid || renderer === layer.renderer}>Apply layer configuration</button>
    </form> : <p className="geospatial-layer-message">Geometry is not available for renderer configuration.</p>}
  </aside>;
}
