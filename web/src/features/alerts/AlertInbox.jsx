import { Link } from 'react-router-dom';

export function AlertInbox({ alerts = [] }) {
  return <section className="feature-page"><div className="page-heading"><div><span className="eyebrow">Persistent alert centre</span><h1>Intelligence alerts</h1><p>AI and ML signals awaiting authorized human review, assignment, escalation, conclusion, and outcome.</p></div></div>
    <div className="panel alert-inbox"><div className="alert-filter"><strong>{alerts.length} alerts in authorized scope</strong><label>Status<select><option>All active</option><option>Generated</option><option>Assigned</option><option>Acknowledged</option></select></label></div>
      {alerts.map(alert => <article key={alert.id}><span className={`alert-state ${String(alert.status).toLowerCase()}`}>{alert.status}</span><div><strong>{alert.title}</strong><p>{alert.recommendation}</p><small>{alert.type} · Unit {alert.scopeUnitId}</small></div><div className="alert-score"><strong>{Math.round((alert.confidence ?? 0) * 100)}%</strong><span>confidence</span></div><Link to={`/alerts/${alert.id}`}>Open discovery</Link></article>)}
      {alerts.length === 0 && <div className="empty-state">No alerts are visible in the current authorized scope.</div>}
    </div>
  </section>;
}
