import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';
import { DataState, StatusBadge, WorkspaceHeader } from '../../components/PlatformPrimitives.jsx';

const value = candidate => candidate ?? 'Unavailable';
const confidence = candidate => Number.isFinite(candidate) ? `${Math.round(candidate * 100)}%` : 'Unavailable';

export function CrimeAnalystDashboard({ data = {} }) {
  const location = useLocation();
  const finding = data.anomalies?.[0];
  return <section className="feature-page role-home crime-analyst-dashboard">
    <WorkspaceHeader eyebrow="Evidence analysis" title="Analyst Workbench" description="Compare governed signals, locate concentrations and open supporting evidence without changing source output." meta={<StatusBadge tone="warning">Human review required</StatusBadge>} />
    {data.partial ? <div className="partial-state">Some analyst evidence is unavailable. Available governed findings remain visible.</div> : null}
    <nav aria-label="Analyst destinations" className="workspace-quick-links">
      <Link to={governedAppLocation('/geospatial', location)}>Open geospatial analysis</Link>
      <Link to={governedAppLocation('/networks', location)}>Open network analysis</Link>
      <Link to={governedAppLocation('/utilities', location)}>Open governed utilities</Link>
    </nav>
    {finding ? <section className="decision-surface analyst-finding">
      <header><div><span className="section-label">Prioritized governed finding</span><h2>{finding.label}</h2></div><StatusBadge tone="warning">{confidence(finding.confidence)} confidence</StatusBadge></header>
      <p>Observed {value(finding.observed)} against baseline {value(finding.expected)}. This signal requires human review and is not proof.</p>
      <dl className="evidence-dl"><div><dt>Utility</dt><dd>{finding.utility ?? 'Governed anomaly detection'}</dd></div><div><dt>Limitation</dt><dd>{data.risk?.limitation ?? 'Area and time evidence only; not an individual prediction.'}</dd></div></dl>
      <Link className="primary-link" to={governedAppLocation('/alerts', location)}>Open supporting evidence</Link>
    </section> : <DataState title="No governed finding is available" message="No analyst signal was returned for the authorized scope and observation period." />}
    <div className="analyst-insight-grid">
      <section className="decision-surface"><h2>What changed</h2><p>Compare the latest governed observation with its prior baseline and retain the model version.</p></section>
      <section className="decision-surface"><h2>Where it concentrates</h2><p>Use district, station and hotspot evidence to test whether the signal is spatially concentrated.</p></section>
      <section className="decision-surface"><h2>When it occurs</h2><p>Review monthly movement and incident-hour patterns before forming a conclusion.</p></section>
    </div>
  </section>;
}
