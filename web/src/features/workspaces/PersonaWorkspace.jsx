import { Link, useLocation } from 'react-router-dom';

import { DataState, StatusBadge, WorkspaceHeader } from '../../components/PlatformPrimitives.jsx';
import { LeadershipView } from '../intelligence/LeadershipView.jsx';
import { governedAppLocation } from '../../app/runtime.js';

const definitions = {
  REGIONAL_LEADERSHIP: ['Jurisdiction Intelligence Pulse', 'Regional evidence requiring coordinated review.'],
  DISTRICT_LEADERSHIP: ['Jurisdiction Intelligence Pulse', 'District and subordinate-unit signals within the current authorized scope.'],
  CRIME_ANALYST: ['Analyst Workbench', 'Prioritize, compare and document evidence without changing the original model output.'],
  STATION_OPERATIONS: ['Operational Intelligence', 'Local signals, assignments and evidence within the authorized station scope.'],
  INVESTIGATOR: ['Investigation Tasks', 'Assigned verification work and authorized related evidence.'],
  PLATFORM_ADMIN: ['Governance Console', 'Platform health and configuration without automatic case-evidence access.'],
  AUDITOR: ['Audit Console', 'Read-only decision, access and model-version traceability.'],
};

function SignalQueue({ anomalies = [] }) {
  if (anomalies.length === 0) return <DataState title="No current signal result" message="No anomaly result was returned for this authorized scope and observation period." />;
  return <div className="operational-list">{anomalies.map(item => <article key={item.id}>
    <StatusBadge tone="warning">Review</StatusBadge>
    <div><strong>{item.label}</strong><span>Observed {item.observed} against baseline {item.expected}</span></div>
    <div className="numeric-evidence"><strong>{Math.round((item.confidence ?? 0) * 100)}%</strong><small>confidence</small></div>
    <Link to="/alerts">Inspect evidence</Link>
  </article>)}</div>;
}

function AnalystWorkspace({ data }) {
  const location = useLocation();
  return <section className="feature-page">
    <WorkspaceHeader eyebrow="Evidence analysis" title="Analyst Workbench" description={definitions.CRIME_ANALYST[1]} meta={<StatusBadge tone="warning">Human review required</StatusBadge>} />
    {data.partial && <div className="partial-state">Some intelligence services are unavailable. Available governed results remain visible.</div>}
    <div className="analyst-workbench">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Prioritized queue</span><h2>System signals</h2></div></div><SignalQueue anomalies={data.anomalies} /></section>
      <section className="panel analysis-canvas"><div className="panel-heading"><div><span className="eyebrow">Synchronized analysis</span><h2>Evidence views</h2></div></div>
        <nav aria-label="Analytical views"><Link to={governedAppLocation('/geospatial', location)}>Map</Link><Link to={governedAppLocation('/intelligence', location)}>Timeline</Link><Link to={governedAppLocation('/networks', location)}>Network</Link><Link to={governedAppLocation('/alerts', location)}>Cases</Link></nav>
        <div className="analysis-summary"><strong>{data.brief?.executiveSummary ?? 'No current brief is available.'}</strong><p>Model output remains immutable. Similarity and correlation are investigative signals, not proof.</p></div>
      </section>
      <aside className="panel evidence-context"><div className="panel-heading"><div><span className="eyebrow">Evidence and limits</span><h2>Review context</h2></div></div>
        <dl><dt>Area-risk limitation</dt><dd>{data.risk?.limitation ?? 'No area-risk result is available.'}</dd><dt>Review state</dt><dd>Awaiting authorized human conclusion</dd></dl>
      </aside>
    </div>
  </section>;
}

function ScopedWorkspace({ role, data }) {
  const [title, description] = definitions[role] ?? ['Authorized Workspace', 'Governed intelligence within the current scope.'];
  const isGovernance = ['PLATFORM_ADMIN', 'AUDITOR'].includes(role);
  return <section className="feature-page">
    <WorkspaceHeader eyebrow={isGovernance ? 'Platform governance' : 'Scoped decision intelligence'} title={title} description={description} meta={!isGovernance && <StatusBadge tone="warning">Human review required</StatusBadge>} />
    {data.partial && <div className="partial-state">Some intelligence services are unavailable. Available governed results remain visible.</div>}
    {isGovernance ? <DataState title="Governed services are connected" message="Operational health, audit and configuration records appear only when their governed endpoints return authorized data." /> : <div className="jurisdiction-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Attention queue</span><h2>Evidence requiring review</h2></div></div><SignalQueue anomalies={data.anomalies} /></section>
      <section className="panel jurisdiction-context"><div className="panel-heading"><div><span className="eyebrow">Current context</span><h2>Hotspot and area risk</h2></div></div>
        {data.hotspots?.[0] ? <dl><dt>Area</dt><dd>{data.hotspots[0].area}</dd><dt>Contributing cases</dt><dd>{data.hotspots[0].caseCount}</dd><dt>Spatial severity</dt><dd>{Math.round((data.hotspots[0].severity ?? 0) * 100)}%</dd></dl> : <p>No hotspot result is available.</p>}
        <p className="limitation-callout">{data.risk?.limitation ?? 'No area-risk result is available.'}</p>
      </section>
    </div>}
  </section>;
}

export function PersonaWorkspace({ role, data = {} }) {
  if (role === 'STATE_LEADERSHIP') return <LeadershipView data={data} />;
  if (role === 'CRIME_ANALYST') return <AnalystWorkspace data={data} />;
  return <ScopedWorkspace role={role} data={data} />;
}
