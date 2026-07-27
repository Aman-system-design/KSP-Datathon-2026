import { STATION_LAYOUT, STATION_REPORTS } from '../../station-operations/station-dashboard-template.js';

export const POLICE_STATION_DASHBOARD_TEMPLATE = Object.freeze({
  key: 'station-operations/v1',
  name: 'Police Station Dashboard',
  description: '[ACE:station-operations:v1:complete]',
  pendingDescription: '[ACE:station-operations:v1:pending]',
  roles: Object.freeze(['STATION_OPERATIONS']),
  reports: STATION_REPORTS,
  layout: STATION_LAYOUT,
});
