import { GovernedPersonaDashboardWorkspace } from './GovernedPersonaDashboardWorkspace.jsx';

const DISTRICT_SOURCES = new Set([
  'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk',
  'districtContext', 'alerts', 'catalog.caseMaster',
]);

export const isDistrictReport = report => DISTRICT_SOURCES.has(report?.definition?.sourceKey);

export function DistrictDashboardWorkspace(props) {
  const districtName = props.workspace?.scopeUnit?.name?.trim() || 'Authorized';
  return <GovernedPersonaDashboardWorkspace
    {...props}
    eyebrow="District leadership dashboard"
    title={`${districtName} District Intelligence`}
    description="District trends, station concentration, crime mix, lifecycle and geospatial evidence within the authorized scope."
  />;
}
