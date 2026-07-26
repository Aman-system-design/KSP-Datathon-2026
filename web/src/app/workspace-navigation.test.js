import { expect, test } from 'vitest';

import { getPersonaPresentation, getWorkspaceNavigation } from './workspace-navigation.js';

const paths = role => getWorkspaceNavigation({ role }).modules.map(item => item.to);

test('state and jurisdiction leaders receive governed intelligence tools within their authorized scope', () => {
  expect(getWorkspaceNavigation({ role: 'STATE_LEADERSHIP' }).home).toBe('/');
  expect(paths('STATE_LEADERSHIP')).toEqual(['/', '/utilities', '/intelligence', '/alerts', '/reports', '/dashboards']);
  expect(getWorkspaceNavigation({ role: 'STATE_LEADERSHIP' }).modules)
    .toContainEqual(expect.objectContaining({ to: '/intelligence', label: 'Intelligence' }));
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
