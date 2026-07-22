import { Link } from 'react-router-dom';

export function LeadershipView({ data }) {
  const anomaly = data?.anomalies?.[0];
  const hotspot = data?.hotspots?.[0];
  const riskScore = data?.risk?.score > 1 ? Math.round(data.risk.score) : Math.round((data?.risk?.score ?? 0) * 100);
  return <section className="feature-page">
    <div className="page-heading command-heading"><div><span className="eyebrow">Statewide intelligence posture</span><h1>State Intelligence Brief</h1><p>{data?.brief?.executiveSummary}</p></div><div className="freshness"><i />Updated from verified run<br /><strong>Human review required</strong></div></div>
    <div className="signal-grid">
      <article className="signal-card critical"><span>Anomaly requiring review</span><strong>{anomaly?.observed ?? '—'}</strong><h2>{anomaly?.label}</h2><p>Expected baseline {anomaly?.expected} · {Math.round((anomaly?.confidence ?? 0) * 100)}% confidence</p><Link to="/alerts">Inspect evidence</Link></article>
      <article className="signal-card"><span>Emerging hotspot</span><strong>{hotspot?.caseCount ?? '—'}</strong><h2>{hotspot?.area}</h2><p>Spatial severity {Math.round((hotspot?.severity ?? 0) * 100)}% · Area signal</p><Link to="/geospatial">Inspect evidence</Link></article>
      <article className="signal-card risk"><span>Explainable area risk</span><strong>{riskScore}</strong><h2>Area risk index</h2><p>{data?.risk?.limitation}</p><Link to="/intelligence">Inspect evidence</Link></article>
    </div>
    <div className="command-grid">
      <section className="panel map-stage"><div className="panel-heading"><div><span className="eyebrow">Geospatial intelligence</span><h2>Hotspot overview</h2></div><span>District drilldown</span></div><div className="map-canvas" role="img" aria-label="Synthetic hotspot overview"><div className="map-grid" />{hotspot && <i className="hotspot one" />}<div className="map-label">{hotspot?.area ?? 'No active hotspot'}<br /><strong>{hotspot ? `${hotspot.caseCount} contributing cases` : 'No current evidence'}</strong></div></div></section>
      <section className="panel priority-list"><div className="panel-heading"><div><span className="eyebrow">AI-prioritized</span><h2>Signals requiring action</h2></div><Link to="/alerts">View all</Link></div>{data?.anomalies?.map(item => <article key={item.id}><i className="severity-dot" /><div><strong>{item.label}</strong><span>Observed {item.observed} against baseline {item.expected}</span></div><b>{Math.round(item.confidence * 100)}%</b></article>)}</section>
    </div>
  </section>;
}
