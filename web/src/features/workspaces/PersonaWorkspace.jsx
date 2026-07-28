import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';
import { demonstrationLabel } from '../../lib/display-text.js';
import { DataState, StatusBadge, WorkspaceHeader } from '../../components/PlatformPrimitives.jsx';
import { LeadershipView } from '../intelligence/LeadershipView.jsx';
import { DistrictLeadershipDashboard } from './DistrictLeadershipDashboard.jsx';
import { CrimeAnalystDashboard } from './CrimeAnalystDashboard.jsx';

const definitions = {
  REGIONAL_LEADERSHIP: ['Jurisdiction Intelligence Pulse', 'Regional evidence requiring coordinated review.'],
  DISTRICT_LEADERSHIP: ['Jurisdiction Intelligence Pulse', 'District and subordinate-unit signals within the current authorized scope.'],
  CRIME_ANALYST: ['Analyst Workbench', 'Prioritize, compare and document evidence without changing the original model output.'],
  STATION_OPERATIONS: ['Operational Intelligence', 'Local signals, assignments and evidence within the authorized station scope.'],
  INVESTIGATOR: ['Investigation Tasks', 'Assigned verification work and authorized related evidence.'],
  PLATFORM_ADMIN: ['Governance Console', 'Platform health and configuration without automatic case-evidence access.'],
  AUDITOR: ['Audit Console', 'Read-only decision, access and model-version traceability.'],
};

const valueOrUnavailable = value => value ?? 'Unavailable';
const percentOrUnavailable = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Unavailable';

function PartialState({ partial }) {
  return partial ? <div className="partial-state">Some intelligence services are unavailable. Available governed results remain visible.</div> : null;
}

function SignalQueue({ anomalies = [], linkLabel = 'Inspect evidence' }) {
  const location = useLocation();
  if (anomalies.length === 0) return <DataState title="No current signal result" message="No anomaly result was returned for this authorized scope and observation period." />;
  return <div className="operational-list">{anomalies.map(item => <article key={item.id}>
    <StatusBadge tone="warning">Review</StatusBadge>
    <div><strong>{item.label}</strong><span>Observed {valueOrUnavailable(item.observed)} against baseline {valueOrUnavailable(item.expected)}</span></div>
    <div className="numeric-evidence"><strong>{percentOrUnavailable(item.confidence)}</strong><small>confidence</small></div>
    <Link to={governedAppLocation('/alerts', location)}>{linkLabel}</Link>
  </article>)}</div>;
}

function AnalystWorkspace({ data }) {
  const location = useLocation();
  return <section className="feature-page role-home">
    <WorkspaceHeader eyebrow="Evidence analysis" title="Analyst Workbench" description={definitions.CRIME_ANALYST[1]} meta={<StatusBadge tone="warning">Human review required</StatusBadge>} />
    <PartialState partial={data.partial} />
    <div className="analyst-workbench">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Prioritized queue</span><h2>System signals</h2></div></div><SignalQueue anomalies={data.anomalies} /></section>
      <section className="panel analysis-canvas"><div className="panel-heading"><div><span className="eyebrow">Synchronized analysis</span><h2>Evidence views</h2></div></div>
        <nav aria-label="Analytical views"><Link to={governedAppLocation('/geospatial', location)}>Map</Link><Link to={governedAppLocation('/intelligence', location)}>Timeline</Link><Link to={governedAppLocation('/networks', location)}>Network</Link><Link to={governedAppLocation('/alerts', location)}>Cases</Link></nav>
        <div className="analysis-summary"><strong>{demonstrationLabel(data.brief?.executiveSummary) ?? 'No current brief is available.'}</strong><p>Model output remains immutable. Similarity and correlation are investigative signals, not proof.</p></div>
      </section>
      <aside className="panel evidence-context"><div className="panel-heading"><div><span className="eyebrow">Evidence and limits</span><h2>Review context</h2></div></div>
        <dl><dt>Area-risk limitation</dt><dd>{data.risk?.limitation ?? 'No area-risk result is available.'}</dd><dt>Review state</dt><dd>Awaiting authorized human conclusion</dd></dl>
      </aside>
    </div>
  </section>;
}

function JurisdictionLeadershipWorkspace({ role, data }) {
  const location = useLocation();
  const [title, description] = definitions[role];
  const hotspot = data.hotspots?.[0];
  return <section className="feature-page role-home">
    <WorkspaceHeader eyebrow="Authorized jurisdiction" title={title} description={description} meta={<StatusBadge tone="warning">Human review required</StatusBadge>} />
    <PartialState partial={data.partial} />
    <div className="role-decision-grid">
      <section className="decision-surface role-decision-grid__main"><header><div><span className="section-label">Decision queue</span><h2>What changed</h2></div><Link to={governedAppLocation('/alerts', location)}>Open alerts</Link></header><SignalQueue anomalies={data.anomalies} /></section>
      <section className="decision-surface"><header><div><span className="section-label">Geospatial evidence</span><h2>Jurisdiction context</h2></div><Link to={governedAppLocation('/geospatial', location)}>Open district map</Link></header>{hotspot ? <dl className="evidence-dl"><div><dt>Area</dt><dd>{hotspot.area}</dd></div><div><dt>Contributing cases</dt><dd>{valueOrUnavailable(hotspot.caseCount)}</dd></div><div><dt>Spatial severity</dt><dd>{percentOrUnavailable(hotspot.severity)}</dd></div></dl> : <p className="honest-empty">No hotspot result is available.</p>}</section>
      <section className="decision-surface"><header><div><span className="section-label">Accountability</span><h2>Operational ownership</h2></div></header><dl className="evidence-dl"><div><dt>Review state</dt><dd>Awaiting authorized decision</dd></div><div><dt>Assignment</dt><dd>Managed in Alert Centre</dd></div><div><dt>Risk limitation</dt><dd>{data.risk?.limitation ?? 'Unavailable'}</dd></div></dl></section>
    </div>
  </section>;
}

function StationWorkspace({ data }) {
  const location = useLocation();
  const hotspot = data.hotspots?.[0];
  return <section className="feature-page role-home">
    <WorkspaceHeader eyebrow="Station operations" title="Operational Intelligence" description={definitions.STATION_OPERATIONS[1]} meta={<Link className="primary-link" to={governedAppLocation('/alerts', location)}>Open local alerts</Link>} />
    <PartialState partial={data.partial} />
    <div className="station-layout">
      <section className="decision-surface"><header><div><span className="section-label">Authorized station</span><h2>Local attention queue</h2></div></header><SignalQueue anomalies={data.anomalies} linkLabel="Review local evidence" /></section>
      <section className="decision-surface"><header><div><span className="section-label">Area awareness</span><h2>Station hotspot context</h2></div><Link to={governedAppLocation('/geospatial', location)}>Open map</Link></header>{hotspot ? <dl className="evidence-dl"><div><dt>Area</dt><dd>{hotspot.area}</dd></div><div><dt>Cases</dt><dd>{valueOrUnavailable(hotspot.caseCount)}</dd></div><div><dt>Severity</dt><dd>{percentOrUnavailable(hotspot.severity)}</dd></div></dl> : <p className="honest-empty">No local hotspot result is available.</p>}<p className="limitation-callout">{data.risk?.limitation ?? 'Area-risk evidence is unavailable.'}</p></section>
    </div>
  </section>;
}

function InvestigatorWorkspace({ data }) {
  const location = useLocation();
  const anomaly = data.anomalies?.[0];
  return <section className="feature-page role-home role-home--investigator">
    <WorkspaceHeader eyebrow="Assigned case work" title="Investigation Tasks" description={definitions.INVESTIGATOR[1]} />
    <PartialState partial={data.partial} />
    <section className="decision-surface investigator-task"><header><div><span className="section-label">Evidence verification</span><h2>Assigned verification</h2></div><StatusBadge tone="warning">Human decision</StatusBadge></header>
      {anomaly ? <article><div><span>System signal</span><strong>{anomaly.label}</strong><p>Observed {valueOrUnavailable(anomaly.observed)} against baseline {valueOrUnavailable(anomaly.expected)}. Verify the linked records; this signal is not proof.</p></div><dl><dt>Confidence</dt><dd>{percentOrUnavailable(anomaly.confidence)}</dd><dt>Source</dt><dd>Latest verified run</dd></dl><Link className="primary-link" to={governedAppLocation('/alerts', location)}>Review assigned evidence</Link></article> : <DataState title="No assigned verification" message="No authorized verification task was returned for this user." />}
    </section>
  </section>;
}

function GovernanceWorkspace({ role }) {
  const [title, description] = definitions[role];
  if (role === 'AUDITOR') return <section className="feature-page role-home"><WorkspaceHeader eyebrow="Independent oversight" title={title} description={description} /><section className="decision-surface governance-summary"><h2>Read-only traceability</h2><p>Access, analytical versions, alert decisions, evidence references and exports remain available only through governed audit records.</p><Link className="primary-link" to="/audit">Open audit records</Link></section></section>;
  return <section className="feature-page role-home"><WorkspaceHeader eyebrow="Platform administration" title={title} description={description} /><div className="governance-actions">
    <Link className="decision-surface" aria-label="Inspect intelligence runs" to="/admin/intelligence-runs"><span className="section-label">Control plane</span><strong>Inspect intelligence runs</strong><p>Review persisted run state, failures, publication and retry eligibility.</p></Link>
    <Link className="decision-surface" aria-label="Review persona workspaces" to="/admin/personas"><span className="section-label">Experience governance</span><strong>Review persona workspaces</strong><p>Inspect configured role homes without inheriting their evidence permissions.</p></Link>
  </div></section>;
}

export function PersonaWorkspace({ role, data = {} }) {
  if (role === 'STATE_LEADERSHIP') return <LeadershipView data={data} />;
  if (role === 'DISTRICT_LEADERSHIP') return <DistrictLeadershipDashboard data={data} />;
  if (role === 'REGIONAL_LEADERSHIP') return <JurisdictionLeadershipWorkspace role={role} data={data} />;
  if (role === 'CRIME_ANALYST') return <CrimeAnalystDashboard data={data} />;
  if (role === 'STATION_OPERATIONS') return <StationWorkspace data={data} />;
  if (role === 'INVESTIGATOR') return <InvestigatorWorkspace data={data} />;
  if (['PLATFORM_ADMIN', 'AUDITOR'].includes(role)) return <GovernanceWorkspace role={role} />;
  return <DataState title="Workspace unavailable" message="No home view is configured for this profile." />;
}
