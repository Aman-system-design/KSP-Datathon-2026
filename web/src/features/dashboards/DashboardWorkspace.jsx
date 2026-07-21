import { Link } from 'react-router-dom';

function Widget({ item }) {
  const row = item.data?.[0] ?? {};
  const value = Object.entries(row).find(([key, candidate]) => /_(sum|avg|min|max|count)$/.test(key) && typeof candidate === 'number')?.[1]
    ?? row.value ?? row.caseCount ?? row.observed;
  const label = row.label ?? (row.unitId !== undefined ? `Unit ${row.unitId}` : 'Current result');
  return <article className="panel report-widget">
    <div className="panel-heading"><div><span className="eyebrow">Governed report</span><h2>{item.title}</h2></div></div>
    {item.status === 'error'
      ? <div className="widget-error"><strong>Widget unavailable</strong><span>Other dashboard intelligence remains available.</span></div>
      : <div className="widget-value"><strong>{value ?? '—'}</strong><span>{label}</span></div>}
    <Link to={`/reports/${item.reportId}`}>Open evidence</Link>
  </article>;
}

export function DashboardWorkspace({ dashboard }) {
  return <section className="feature-page">
    <div className="page-heading"><div><span className="eyebrow">Role workspace</span><h1>{dashboard?.name ?? 'Command workspace'}</h1><p>Reusable intelligence widgets. Every result is recalculated within the current viewer’s authorized geography.</p></div></div>
    <div className="dashboard-grid">{(dashboard?.items ?? []).map(item => <Widget key={item.id} item={item} />)}</div>
  </section>;
}
