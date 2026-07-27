import { expect, test } from 'vitest';

import { getPersonaPresentation, getWorkspaceNavigation } from './workspace-navigation.js';

const paths = role => getWorkspaceNavigation({ role }).modules.map(item => item.to);

test('command center keeps one operational navigation contract across every screen', () => {
  expect(getWorkspaceNavigation({ role: 'COMMAND_CENTER' }).modules.map(item => item.label)).toEqual([
    'Home', 'Intelligence', 'Alerts', 'Reports', 'Utilities', 'Dashboards',
  ]);
  expect(paths('COMMAND_CENTER')).not.toContain('/geospatial');
  expect(paths('COMMAND_CENTER')).not.toContain('/networks');
});

test('state leadership uses Home as its only intelligence dashboard entry', () => {
  expect(getWorkspaceNavigation({ role: 'STATE_LEADERSHIP' }).home).toBe('/');
  expect(paths('STATE_LEADERSHIP')).toEqual(['/', '/utilities', '/alerts', '/reports', '/dashboards']);
  expect(getWorkspaceNavigation({ role: 'STATE_LEADERSHIP' }).modules)
    .not.toContainEqual(expect.objectContaining({ to: '/intelligence' }));
});

test('other personas retain their existing navigation without State Leadership changes', () => {
  const expected = ['/', '/utilities', '/alerts', '/geospatial', '/networks', '/reports', '/dashboards'];
  expect(paths('DISTRICT_LEADERSHIP')).toEqual(expected);
  expect(paths('CRIME_ANALYST')).toEqual(expected);
  expect(paths('STATION_OPERATIONS')).toEqual(expected);
  expect(getWorkspaceNavigation({ role: 'DISTRICT_LEADERSHIP' }).workspaceLabel).toBe('Jurisdiction Intelligence Pulse');
  expect(paths('DISTRICT_LEADERSHIP')).not.toContain('/admin');
});

test('operational workspaces expose utilities without adding another broad module', () => {
  for (const role of ['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS', 'PLATFORM_ADMIN']) {
    expect(paths(role)).toContain('/utilities');
  }
  expect(paths('INVESTIGATOR')).not.toContain('/utilities');
  expect(getWorkspaceNavigation({ role: 'CRIME_ANALYST' }).modules)
    .toContainEqual(expect.objectContaining({ to: '/utilities', label: 'Utilities' }));
});

test('analyst and station navigation expose work tools without governance controls', () => {
  expect(getWorkspaceNavigation({ role: 'CRIME_ANALYST' }).workspaceLabel).toBe('Analyst Workbench');
  expect(paths('CRIME_ANALYST')).toEqual(expect.arrayContaining(['/reports', '/dashboards', '/networks']));
  expect(paths('CRIME_ANALYST')).toContain('/geospatial');
  expect(getWorkspaceNavigation({ role: 'STATION_OPERATIONS' }).workspaceLabel).toBe('Operational Intelligence');
  expect(paths('STATION_OPERATIONS')).toContain('/reports');
  expect(paths('STATION_OPERATIONS')).not.toContain('/admin/personas');
});

test('administrator and auditor receive governance navigation without case intelligence', () => {
  expect(paths('PLATFORM_ADMIN')).toEqual(['/', '/utilities', '/admin', '/admin/intelligence-runs', '/admin/personas']);
  expect(paths('AUDITOR')).toEqual(['/', '/audit']);
  expect(paths('PLATFORM_ADMIN')).not.toContain('/networks');
});

test('demo presenter starts at the safe persona directory and cannot invent a production permission', () => {
  const navigation = getWorkspaceNavigation({ role: 'DEMO_PRESENTER' });
  expect(navigation.home).toBe('/admin/personas');
  expect(navigation.modules.map(item => item.to)).toEqual(['/admin/personas', '/?persona=COMMAND_CENTER']);
});

test('unknown roles use neutral UI copy while backend access remains fail-closed', () => {
  expect(getWorkspaceNavigation({ role: 'UNKNOWN' }).workspaceLabel).toBe('Workspace');
  expect(getPersonaPresentation('UNKNOWN')).toEqual(expect.objectContaining({
    label: 'Workspace', workspace: 'Operational view', scope: 'Assigned scope',
  }));
});

test('regional leadership is not offered as an MVP persona', () => {
  expect(getPersonaPresentation('REGIONAL_LEADERSHIP')).toBeNull();
});
