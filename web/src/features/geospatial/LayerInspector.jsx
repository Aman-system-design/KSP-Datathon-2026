import { useEffect, useMemo, useState } from 'react';

const RENDERERS = Object.freeze({
  POINT: ['POINT', 'CLUSTER', 'HEATMAP'],
  MULTI_POINT: ['POINT', 'CLUSTER', 'HEATMAP'],
  H3: ['H3', 'CHOROPLETH'],
  POLYGON: ['CHOROPLETH'],
  MULTI_POLYGON: ['CHOROPLETH'],
  ADMIN_BOUNDARY: ['CHOROPLETH'],
});

export function LayerInspector({ layer, onApply, onClose }) {
  const options = useMemo(() => RENDERERS[layer?.dataset?.geometryType] ?? [], [layer]);
  const [renderer, setRenderer] = useState(layer?.renderer ?? '');
  useEffect(() => setRenderer(layer?.renderer ?? ''), [layer?.id, layer?.renderer]);
  if (!layer) return null;
  const valid = options.includes(renderer);
  return <aside className="geospatial-panel geospatial-inspector" aria-label={`Configure ${layer.name}`}>
    <header className="geospatial-drawer-heading">
      <div><span>Layer inspector</span><h2>{layer.name}</h2></div>
      <button type="button" aria-label="Close layer inspector" onClick={onClose}>Close</button>
    </header>
    <section><h3>Data</h3><dl>
      <div><dt>Dataset</dt><dd>{layer.datasetId}</dd></div>
      <div><dt>Geometry</dt><dd>{layer.dataset?.geometryType ?? 'Unavailable'}</dd></div>
      <div><dt>Status</dt><dd>{layer.state}</dd></div>
    </dl></section>
    {layer.spatialStatus === 'AVAILABLE' ? <form onSubmit={event => { event.preventDefault(); if (valid) onApply(layer.id, { renderer }); }}>
      <section><h3>Visual</h3><label>Renderer<select aria-label="Renderer" value={renderer} onChange={event => setRenderer(event.target.value)}>
        {options.map(option => <option key={option}>{option}</option>)}
      </select></label></section>
      <button className="primary-button" type="submit" disabled={!valid || renderer === layer.renderer}>Apply layer configuration</button>
    </form> : <p className="geospatial-layer-message">Geometry is not available for renderer configuration.</p>}
  </aside>;
}
