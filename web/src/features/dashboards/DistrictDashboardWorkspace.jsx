import { GovernedPersonaDashboardWorkspace } from './GovernedPersonaDashboardWorkspace.jsx';

const DISTRICT_SOURCES = new Set([
  'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk',
  'districtContext', 'alerts', 'catalog.caseMaster',
]);

export const isDistrictReport = report => DISTRICT_SOURCES.has(report?.definition?.sourceKey);

export const districtDisplayName = name => /\bdistrict$/iu.test(name) ? name : `${name} District`;

export function DistrictDashboardWorkspace(props) {
  const districtName = props.workspace?.scopeUnit?.name?.trim() || 'Authorized';
  const displayName = districtDisplayName(districtName);
  return <GovernedPersonaDashboardWorkspace
    {...props}
    eyebrow="District leadership dashboard"
    title={`${displayName} Intelligence`}
    scopeLabel={displayName}
    scopeAriaLabel="Authorized district"
    description="District trends, station concentration, crime mix, lifecycle and geospatial evidence within the authorized scope."
  />;
}
