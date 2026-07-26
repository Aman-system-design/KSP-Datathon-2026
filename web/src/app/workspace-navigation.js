const intelligenceModules = Object.freeze([
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/utilities', label: 'Utilities', icon: 'utilities' },
  { to: '/alerts', label: 'Alerts', icon: 'alerts' },
  { to: '/geospatial', label: 'Geospatial', icon: 'map' },
  { to: '/networks', label: 'Networks', icon: 'network' },
  { to: '/reports', label: 'Reports', icon: 'report' },
  { to: '/dashboards', label: 'Dashboards', icon: 'dashboard' },
]);

const stateLeadershipModules = Object.freeze([
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/utilities', label: 'Utilities', icon: 'utilities' },
  { to: '/intelligence', label: 'Intelligence', icon: 'intelligence' },
  { to: '/alerts', label: 'Alerts', icon: 'alerts' },
  { to: '/reports', label: 'Reports', icon: 'report' },
  { to: '/dashboards', label: 'Dashboards', icon: 'dashboard' },
]);

const roleDefinitions = Object.freeze({
  STATE_LEADERSHIP: { workspaceLabel: 'State Intelligence Brief', modules: stateLeadershipModules },
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
      { to: '/utilities', label: 'Utilities', icon: 'utilities' },
      { to: '/admin', label: 'Governance', icon: 'admin' },
      { to: '/admin/intelligence-runs', label: 'Intelligence runs', icon: 'intelligence' },
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
      { to: '/?persona=COMMAND_CENTER', label: 'Command Centre', icon: 'command' },
    ],
  },
});

const unavailable = Object.freeze({
  workspaceLabel: 'Workspace', home: '/', modules: [{ to: '/', label: 'Home', icon: 'home' }],
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
  { role: 'STATE_LEADERSHIP', label: 'State Leadership', workspace: 'State Intelligence Brief', route: '/?persona=STATE_LEADERSHIP', scope: 'Statewide', icon: 'intelligence' },
  { role: 'DISTRICT_LEADERSHIP', label: 'District Leadership', workspace: 'Jurisdiction Intelligence Pulse', route: '/?persona=DISTRICT_LEADERSHIP', scope: 'Authorized district', icon: 'dashboard' },
  { role: 'CRIME_ANALYST', label: 'Crime Analyst', workspace: 'Analyst Workbench', route: '/?persona=CRIME_ANALYST', scope: 'Assigned units and cases', icon: 'network' },
  { role: 'STATION_OPERATIONS', label: 'Station Operations', workspace: 'Operational Intelligence', route: '/?persona=STATION_OPERATIONS', scope: 'Authorized station', icon: 'alerts' },
]);

export const commandCentreWorkspace = Object.freeze({
  role: 'COMMAND_CENTER',
  label: 'Command Centre',
  workspace: 'Live Operational Overview',
  scope: 'Presentation display',
  icon: 'command',
  destination: Object.freeze({ type: 'persona', role: 'COMMAND_CENTER' }),
});

const personaPresentationByRole = new Map(
  personaWorkspaceDefinitions.map(definition => [definition.role, definition]),
);

export function getPersonaPresentation(role) {
  if (role === 'REGIONAL_LEADERSHIP') return null;
  return personaPresentationByRole.get(role) ?? {
    role,
    label: 'Workspace',
    workspace: 'Operational view',
    scope: 'Assigned scope',
    icon: 'home',
  };
}
