import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';
import { DataState, StatusBadge, WorkspaceHeader } from '../../components/PlatformPrimitives.jsx';
import { ReportPreview } from '../reports/ReportPreview.jsx';

const INSIGHTS = [
  ['monthlyTrend', 'Monthly FIR trend'],
  ['stationConcentration', 'Station concentration'],
  ['crimeMix', 'Crime mix'],
  ['lifecycle', 'Lifecycle health'],
];

function InsightCard({ title, report }) {
  return <section className="decision-surface district-insight-card">
    <header><h2>{title}</h2></header>
    {report?.definition && report?.rows?.length
      ? <ReportPreview appearance="light" density="dashboard" definition={report.definition} preview={report.rows} hasRun />
      : <DataState title="No governed result is available" message="Run or add the corresponding viewer-scoped report to populate this insight." />}
  </section>;
}

export function DistrictLeadershipDashboard({ data = {} }) {
  const location = useLocation();
  const scopeName = data.scopeName ?? 'Authorized district';
  return <section className="feature-page role-home district-leadership-dashboard">
    <WorkspaceHeader
      eyebrow="District leadership"
      title={`${scopeName} operational pulse`}
      description="Changes, workload concentration and case progression within the authorized district scope."
      meta={<StatusBadge tone="warning">Human review required</StatusBadge>}
    />
    {data.partial ? <div className="partial-state">Some district intelligence is unavailable. Available governed results remain visible.</div> : null}
    <nav aria-label="District intelligence destinations" className="workspace-quick-links">
      <Link to={governedAppLocation('/geospatial', location)}>Open district map</Link>
      <Link to={governedAppLocation('/reports', location)}>Open reports</Link>
      <Link to={governedAppLocation('/utilities', location)}>Open utilities</Link>
    </nav>
    <div className="district-insight-grid">
      {INSIGHTS.map(([key, title]) => <InsightCard key={key} title={title} report={data.reports?.[key]} />)}
    </div>
  </section>;
}
