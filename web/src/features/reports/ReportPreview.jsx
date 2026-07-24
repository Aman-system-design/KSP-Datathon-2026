import { Suspense } from 'react';

export function ReportPreview({ api, mapPreview, preview, EmbeddedMapComponent }) {
  return <section className="panel preview-panel" aria-label="Report preview">
    <div className="panel-heading"><div><h2>Live preview</h2><p>Executed within the current viewer's authorized scope.</p></div><span>Viewer scoped</span></div>
    {mapPreview ? <Suspense fallback={<div className="loading-state" role="status">Loading governed map…</div>}><EmbeddedMapComponent api={api} mapExecution={mapPreview} /></Suspense>
      : preview.length === 0 ? <div className="empty-state report-empty-state"><strong>Preview your governed report</strong><span>Choose data, visualization and configuration, then save and preview.</span><small>Configure the report to inspect live governed results.</small></div>
        : <div className="bar-list">{preview.map((row, index) => { const label = row.unitId !== undefined ? `Unit ${row.unitId}` : Object.values(row)[0]; const value = row.observed ?? row.value ?? row.caseCount ?? '—'; return <div className="bar-row" key={index}><span>{label}</span><div><i style={{ width: `${Math.min(100, Number(value) * 5)}%` }} /></div><strong>{value}</strong></div>; })}</div>}
  </section>;
}
