const intelligenceModules = Object.freeze([
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/intelligence', label: 'Intelligence', icon: 'intelligence' },
  { to: '/alerts', label: 'Alerts', icon: 'alerts' },
  { to: '/maps', label: 'Hotspots', icon: 'map' },
  { to: '/networks', label: 'Networks', icon: 'network' },
  { to: '/reports', label: 'Reports', icon: 'report' },
  { to: '/dashboards', label: 'Dashboards', icon: 'dashboard' },
]);

const roleDefinitions = Object.freeze({
  STATE_LEADERSHIP: { workspaceLabel: 'State Intelligence Brief', modules: intelligenceModules },
  REGIONAL_LEADERSHIP: { workspaceLabel: 'Jurisdiction Intelligence Pulse', modules: intelligenceModules },
  DISTRICT_LEADERSHIP: { workspaceLabel: 'Jurisdiction Intelligence Pulse', modules: intelligenceModules },
  CRIME_ANALYST: { workspaceLabel: 'Analyst Workbench', modules: intelligenceModules },
  STATION_OPERATIONS: {
    workspaceLabel: 'Operational Intelligence',
    modules: intelligenceModules.filter(item => item.to !== '/reports'),
  },
  INVESTIGATOR: {
    workspaceLabel: 'Investigation Tasks',
    modules: intelligenceModules.filter(item => ['/', '/alerts', '/networks'].includes(item.to)),
  },
  PLATFORM_ADMIN: {
    workspaceLabel: 'Governance Console',
    modules: [
      { to: '/', label: 'Home', icon: 'home' },
      { to: '/admin', label: 'Governance', icon: 'admin' },
      { to: '/admin/personas', label: 'Persona workspaces', icon: 'people' },
    ],
  },
  AUDITOR: {
    workspaceLabel: 'Audit Console',
    modules: [{ to: '/', label: 'Home', icon: 'home' }, { to: '/audit', label: 'Audit', icon: 'audit' }],
  },
  DEMO_PRESENTER: {
    workspaceLabel: 'Persona Workspaces', home: '/admin/personas',
    modules: [
      { to: '/admin/personas', label: 'Persona workspaces', icon: 'people' },
      { to: '/command-centre', label: 'Command Centre', icon: 'command' },
    ],
  },
});

const unavailable = Object.freeze({
  workspaceLabel: 'Authorized Workspace', home: '/', modules: [{ to: '/', label: 'Home', icon: 'home' }],
});

export function getWorkspaceNavigation({ role } = {}) {
  const definition = roleDefinitions[role] ?? unavailable;
  return Object.freeze({
    workspaceLabel: definition.workspaceLabel,
    home: definition.home ?? '/',
    modules: Object.freeze(definition.modules.map(item => Object.freeze({ ...item }))),
  });
}

export const personaWorkspaceDefinitions = Object.freeze([
  { role: 'STATE_LEADERSHIP', label: 'State Leadership', workspace: 'State Intelligence Brief', route: '/?persona=STATE_LEADERSHIP', scope: 'State' },
  { role: 'REGIONAL_LEADERSHIP', label: 'Regional Leadership', workspace: 'Jurisdiction Intelligence Pulse', route: '/?persona=REGIONAL_LEADERSHIP', scope: 'Authorized region' },
  { role: 'DISTRICT_LEADERSHIP', label: 'District Leadership', workspace: 'Jurisdiction Intelligence Pulse', route: '/?persona=DISTRICT_LEADERSHIP', scope: 'Authorized district' },
  { role: 'CRIME_ANALYST', label: 'Crime Analyst', workspace: 'Analyst Workbench', route: '/?persona=CRIME_ANALYST', scope: 'Assigned units and cases' },
  { role: 'STATION_OPERATIONS', label: 'Station Operations', workspace: 'Operational Intelligence', route: '/?persona=STATION_OPERATIONS', scope: 'Authorized station' },
]);
