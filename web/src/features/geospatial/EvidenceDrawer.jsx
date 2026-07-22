import { useEffect, useId, useRef } from 'react';

function safeValue(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => safeValue(item)).join(', ');
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_, item) => {
      if (typeof item === 'bigint') return item.toString();
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
      }
      return item;
    });
  } catch { return 'Unavailable'; }
}

function dateTime(timestamp, locale, timezone) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return 'Not provided';
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium', timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}),
    }).format(parsed);
  } catch { return new Date(parsed).toISOString(); }
}

function EvidenceRow({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function safeActions(metadata) {
  if (!Array.isArray(metadata?.contributingRecords)) return [];
  return metadata.contributingRecords.flatMap(record => {
    if (record?.authorized !== true || !Array.isArray(record.actions)) return [];
    return record.actions.flatMap(action => (
      typeof action?.label === 'string' && typeof action?.href === 'string'
      && action.href.startsWith('/') && !action.href.startsWith('//')
        ? [{ recordId: record.id, label: action.label, href: action.href }] : []
    ));
  });
}

export function EvidenceDrawer({
  selection, layer, onClose, onAcceptUpdate, locale = 'en-GB', timezone = 'UTC',
}) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    closeButtonRef.current?.focus();
    return () => { returnFocusRef.current?.focus?.(); };
  }, []);
  if (!selection || !layer) return null;
  const metadata = layer.meta ?? {};
  const displayFields = new Set(Object.entries(layer.dataset?.fields ?? {})
    .filter(([, definition]) => Array.isArray(definition?.uses) && definition.uses.includes('display'))
    .map(([field]) => field));
  const properties = Object.fromEntries(Object.entries(selection.properties ?? {})
    .filter(([field]) => displayFields.has(field)));
  const actions = safeActions(metadata);
  const closeOnEscape = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
  };
  return <aside
    className="geospatial-panel geospatial-evidence" role="dialog" aria-modal="false"
    aria-labelledby={titleId} onKeyDown={closeOnEscape}
  >
    <header className="geospatial-drawer-heading">
      <div><span>Authorized feature evidence</span><h2 id={titleId}>Evidence for {selection.id}</h2></div>
      <button ref={closeButtonRef} type="button" aria-label="Close evidence" onClick={onClose}>Close</button>
    </header>
    {layer.pendingUpdate ? <div className="geospatial-update-notice" role="status">
      <strong>Newer verified intelligence is available.</strong>
      <span>The open evidence remains unchanged until you accept the update.</span>
      <button type="button" onClick={() => onAcceptUpdate(layer.id)}>Load newer intelligence</button>
    </div> : null}
    <section><h3>Evidence summary</h3><dl>
      <EvidenceRow label="Source dataset">{safeValue(layer.dataset?.name ?? layer.datasetId)}</EvidenceRow>
      <EvidenceRow label="Provenance">{safeValue(layer.dataset?.provenance ?? metadata.provenance)}</EvidenceRow>
      <EvidenceRow label="Freshness">{layer.state === 'STALE' ? 'STALE — last verified output retained' : safeValue(layer.state)}</EvidenceRow>
      <EvidenceRow label="Published at">{dateTime(metadata.publishedAt, locale, timezone)}</EvidenceRow>
      <EvidenceRow label="Method">{safeValue(metadata.modelOrMethod ?? properties.method)}</EvidenceRow>
      <EvidenceRow label="Version">{safeValue(metadata.recordMethodVersion ?? metadata.engineVersion)}</EvidenceRow>
      <EvidenceRow label="Measure">{safeValue(properties.measure ?? properties.value ?? properties.magnitude)}</EvidenceRow>
      <EvidenceRow label="Units">{safeValue(properties.units ?? metadata.units)}</EvidenceRow>
      <EvidenceRow label="Confidence">{safeValue(properties.confidence ?? metadata.confidence)}</EvidenceRow>
      <EvidenceRow label="Quality">{safeValue(metadata.qualityMetrics)}</EvidenceRow>
    </dl></section>
    <section><h3>Run context</h3><dl>
      <EvidenceRow label="Run group">{safeValue(metadata.runGroupId)}</EvidenceRow>
      <EvidenceRow label="Parameters">{safeValue(metadata.parameterSet ?? metadata.parameters)}</EvidenceRow>
      <EvidenceRow label="Generated">{dateTime(metadata.generatedAt, locale, timezone)}</EvidenceRow>
      <EvidenceRow label="Observation from">{dateTime(metadata.observationWindow?.from, locale, timezone)}</EvidenceRow>
      <EvidenceRow label="Observation to">{dateTime(metadata.observationWindow?.to, locale, timezone)}</EvidenceRow>
      <EvidenceRow label="Source records">{safeValue(metadata.sourceRecordCount)}</EvidenceRow>
      <EvidenceRow label="Limitations">{safeValue(metadata.limitations)}</EvidenceRow>
      <EvidenceRow label="Request">{safeValue(metadata.requestId)}</EvidenceRow>
    </dl></section>
    <section><h3>Authorized feature fields</h3><dl>{Object.entries(properties).map(([key, item]) => (
      <EvidenceRow key={key} label={key}>{safeValue(item)}</EvidenceRow>
    ))}</dl></section>
    {actions.length > 0 ? <section><h3>Contributing records</h3><ul className="geospatial-evidence-actions">
      {actions.map(action => <li key={`${action.recordId}:${action.href}`}>
        <span>{safeValue(action.recordId)}</span><a href={action.href}>{action.label}</a>
      </li>)}
    </ul></section> : null}
  </aside>;
}
