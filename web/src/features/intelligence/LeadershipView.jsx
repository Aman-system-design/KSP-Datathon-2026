import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';

const percent = value => `${Math.round((value ?? 0) * 100)}%`;

export function LeadershipView({ data = {} }) {
  const location = useLocation();
  const anomaly = data.anomalies?.[0];
  const hotspot = data.hotspots?.[0];
  const riskScore = data.risk?.score > 1 ? Math.round(data.risk.score) : Math.round((data.risk?.score ?? 0) * 100);

  return <section className="feature-page role-home role-home--leadership">
    <header className="role-home__header">
      <div><span className="role-kicker">Statewide decision intelligence</span><h1>State Intelligence Brief</h1><p>{data.brief?.executiveSummary ?? 'No current statewide brief is available for this authorized scope.'}</p></div>
      <div className="data-as-of"><i /><span>Data as of</span><strong>Latest verified run</strong></div>
    </header>

    <div className="leadership-layout">
      <section className="decision-surface leadership-developments">
        <header><div><span className="section-label">Decision queue</span><h2>Prioritized developments</h2></div><Link to={governedAppLocation('/alerts', location)}>Open Alert Centre</Link></header>
        {anomaly ? <article className="development-row development-row--selected">
          <span className="development-severity" aria-label="Elevated attention" />
          <div><strong>{anomaly.label}</strong><p>Observed {anomaly.observed} against expected baseline {anomaly.expected}</p></div>
          <div><strong>{percent(anomaly.confidence)}</strong><span>confidence</span></div>
          <Link to={governedAppLocation('/alerts', location)}>Inspect evidence</Link>
        </article> : <p className="honest-empty">No prioritized development was returned by the latest verified run.</p>}
      </section>

      <section className="decision-surface leadership-context">
        <header><div><span className="section-label">Geographic context</span><h2>{hotspot?.area ?? 'No active hotspot'}</h2></div><Link to={governedAppLocation('/geospatial', location)}>Open statewide map</Link></header>
        <div className="context-map" role="img" aria-label="Geographic context for selected intelligence development">
          <span className="context-map__grid" />{hotspot ? <span className="context-map__focus" /> : null}
          <div><strong>{hotspot ? `${hotspot.caseCount} contributing cases` : 'No hotspot evidence'}</strong><span>{hotspot ? `${percent(hotspot.severity)} spatial severity` : 'Latest verified run'}</span></div>
        </div>
      </section>

      <section className="decision-surface evidence-explanation">
        <header><div><span className="section-label">Explainability</span><h2>Why this needs attention</h2></div></header>
        <dl>
          <div><dt>Observed</dt><dd>{anomaly?.observed ?? '—'}</dd></div>
          <div><dt>Expected baseline</dt><dd>{anomaly?.expected ?? '—'}</dd></div>
          <div><dt>Confidence</dt><dd>{anomaly ? percent(anomaly.confidence) : '—'}</dd></div>
          <div><dt>Area risk</dt><dd>{Number.isFinite(riskScore) ? riskScore : '—'}</dd></div>
        </dl>
        <p>{data.risk?.limitation ?? 'Area-risk evidence is unavailable for this run.'}</p>
        <Link to={governedAppLocation('/intelligence', location)}>Inspect evidence model</Link>
      </section>

      <section className="decision-surface ownership-panel">
        <header><div><span className="section-label">Human control</span><h2>Ownership and action</h2></div></header>
        <dl><div><dt>Review status</dt><dd>{anomaly?.reviewStatus ?? 'Human review required'}</dd></div><div><dt>Current owner</dt><dd>{anomaly?.owner ?? 'Open Alert Centre for current owner'}</dd></div><div><dt>Model output</dt><dd>Immutable evidence record</dd></div></dl>
        <Link className="primary-link" to={governedAppLocation('/alerts', location)}>Review and assign</Link>
      </section>
    </div>
  </section>;
}
