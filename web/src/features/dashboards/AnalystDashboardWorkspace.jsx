import { GovernedPersonaDashboardWorkspace } from './GovernedPersonaDashboardWorkspace.jsx';

const ANALYST_SOURCES = new Set([
  'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk',
  'alerts', 'catalog.caseMaster',
]);

export const isAnalystReport = report => ANALYST_SOURCES.has(report?.definition?.sourceKey);

export function AnalystDashboardWorkspace(props) {
  return <GovernedPersonaDashboardWorkspace
    {...props}
    eyebrow="Crime analyst dashboard"
    title="Analyst Evidence Dashboard"
    description="Compare governed anomalies, patterns, hotspots and evidence. Analytical signals require human review and are not proof."
    reportPredicate={isAnalystReport}
  />;
}
