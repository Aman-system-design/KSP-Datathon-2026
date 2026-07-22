import { useState } from 'react';

export function VisibleFeatureTable({ features, onSelect }) {
  const [open, setOpen] = useState(true);
  return <section className={`geospatial-feature-results${open ? ' is-open' : ''}`}>
    <header>
      <div><h2>Visible features</h2><span>{features.length} authorized results</span></div>
      <button type="button" aria-expanded={open} aria-controls="geospatial-feature-table" onClick={() => setOpen(value => !value)}>
        {open ? 'Collapse table' : 'Expand table'}
      </button>
    </header>
    {open ? <div className="geospatial-table-scroll" id="geospatial-feature-table">
      <table aria-label="Visible authorized map features">
        <thead><tr><th>Feature</th><th>Layer</th><th>Details</th><th>Evidence</th></tr></thead>
        <tbody>{features.map(feature => <tr key={`${feature.layerId}:${feature.id}`}>
          <td>{feature.id}</td><td>{feature.layerName ?? feature.layerId}</td>
          <td>{Object.entries(feature.properties ?? {}).slice(0, 3).map(([key, item]) => `${key}: ${item}`).join(' · ') || 'No display fields'}</td>
          <td><button type="button" aria-label={`Open evidence for ${feature.id}`} onClick={() => onSelect({
            layerId: feature.layerId, id: feature.id, properties: feature.properties,
          })}>Open</button></td>
        </tr>)}</tbody>
      </table>
      {features.length === 0 ? <p className="geospatial-muted">No authorized features are visible in the current map.</p> : null}
    </div> : null}
  </section>;
}
