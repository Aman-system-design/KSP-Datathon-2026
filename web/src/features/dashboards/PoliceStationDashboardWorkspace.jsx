import { GovernedPersonaDashboardWorkspace } from './GovernedPersonaDashboardWorkspace.jsx';
import { demonstrationLabel } from '../../lib/display-text.js';

const POLICE_STATION_SOURCES = new Set(['stationCases', 'alerts']);

export const isPoliceStationReport = report => POLICE_STATION_SOURCES.has(report?.definition?.sourceKey);

export function PoliceStationDashboardWorkspace(props) {
  const stationName = demonstrationLabel(props.workspace?.scopeUnit?.name?.trim()) || 'Local station';
  return <GovernedPersonaDashboardWorkspace
    {...props}
    eyebrow={stationName}
    title="Police Station Dashboard"
    description="Station-scoped case workload, ageing, active alerts, lifecycle and incident patterns from governed reports."
  />;
}
