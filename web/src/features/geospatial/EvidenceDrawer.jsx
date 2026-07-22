function value(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function dateTime(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(parsed)
    : 'Not provided';
}

export function EvidenceDrawer({ selection, layer, onClose, onAcceptUpdate }) {
  if (!selection || !layer) return null;
  const metadata = layer.meta ?? {};
  return <aside className="geospatial-panel geospatial-evidence" role="complementary" aria-label={`Evidence for ${selection.id}`}>
    <header className="geospatial-drawer-heading">
      <div><span>Authorized feature evidence</span><h2>Evidence for {selection.id}</h2></div>
      <button type="button" aria-label="Close evidence" onClick={onClose}>Close</button>
    </header>
    {layer.pendingUpdate ? <div className="geospatial-update-notice" role="status">
      <strong>Newer verified intelligence is available.</strong>
      <span>The open evidence remains unchanged until you accept the update.</span>
      <button type="button" onClick={() => onAcceptUpdate(layer.id)}>Load newer intelligence</button>
    </div> : null}
    <section><h3>Feature</h3><dl>{Object.entries(selection.properties ?? {}).map(([key, item]) => <div key={key}><dt>{key}</dt><dd>{value(item)}</dd></div>)}</dl></section>
    <section><h3>Run and method</h3><dl>
      <div><dt>Run group</dt><dd>{value(metadata.runGroupId)}</dd></div>
      <div><dt>Method version</dt><dd>{value(metadata.recordMethodVersion ?? metadata.engineVersion)}</dd></div>
      <div><dt>Generated</dt><dd>{dateTime(metadata.generatedAt)}</dd></div>
      <div><dt>Source records</dt><dd>{value(metadata.sourceRecordCount)}</dd></div>
    </dl></section>
    <section><h3>Observation and limitations</h3><dl>
      <div><dt>From</dt><dd>{dateTime(metadata.observationWindow?.from)}</dd></div>
      <div><dt>To</dt><dd>{dateTime(metadata.observationWindow?.to)}</dd></div>
      <div><dt>Limitations</dt><dd>{value(metadata.limitations)}</dd></div>
      <div><dt>Request</dt><dd>{value(metadata.requestId)}</dd></div>
    </dl></section>
  </aside>;
}
