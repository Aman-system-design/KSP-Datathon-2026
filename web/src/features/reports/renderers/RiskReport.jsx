export function RiskReport({ points, variant = 'risk', onSelect, showValues = true }) {
  const max = Math.max(...points.map(point => point.value ?? 0), 1);
  const score = Number(points[0]?.value ?? 0);
  return <div aria-label={`${variant} report visualization`} className={`report-risk report-risk--${variant}`} data-testid={`report-${variant}-chart`}>
    {variant === 'risk' && <section className="report-risk__summary">
      <div aria-label={`Risk score ${score}`} className="report-risk__gauge" style={{ '--risk-score': `${Math.min(100, Math.max(0, score)) * 3.6}deg` }}><strong>{score.toLocaleString()}</strong><span>/100</span></div>
      <div><span>Explainable intelligence</span><strong>{points[0]?.label ?? 'Operational risk'}</strong><small>Score derived from the governed factors shown below.</small></div>
    </section>}
    <div className="report-risk__factors" data-testid="report-risk-factors">{points.map((point, index) => <button aria-label={`${point.label}: ${point.value ?? 'No value'}`} title={`${point.label}: ${point.value ?? 'No value'}`} key={index} onClick={() => onSelect?.(point.row)}><span>{point.label}</span><div><i style={{ width: `${Math.max(2, (point.value ?? 0) / max * 100)}%` }} /></div>{showValues && <strong>{Number(point.value ?? 0).toLocaleString()}</strong>}</button>)}</div>
  </div>;
}
