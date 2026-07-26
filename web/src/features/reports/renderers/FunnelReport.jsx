export function FunnelReport({ points, onSelect, showValues = true }) {
  const max = Math.max(...points.map(point => point.value ?? 0), 1);
  return <div aria-label="funnel report visualization" className="report-funnel" data-testid="report-funnel-chart">{points.map((point, index) => <button aria-label={`${point.label}: ${point.value ?? 'No value'}`} title={`${point.label}: ${point.value ?? 'No value'}`} key={index} onClick={() => onSelect?.(point.row)} style={{ width: `${Math.max(28, (point.value ?? 0) / max * 100)}%` }}><span>{point.label}</span>{showValues && <strong>{point.value ?? '—'}</strong>}</button>)}</div>;
}
