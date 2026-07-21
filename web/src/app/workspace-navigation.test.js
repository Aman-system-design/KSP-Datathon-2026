import { expect, test } from 'vitest';

import { getWorkspaceNavigation } from './workspace-navigation.js';

const paths = role => getWorkspaceNavigation({ role }).modules.map(item => item.to);

test('state and jurisdiction leaders default to intelligence within their authorized scope', () => {
  expect(getWorkspaceNavigation({ role: 'STATE_LEADERSHIP' }).home).toBe('/');
  expect(paths('STATE_LEADERSHIP')).toEqual(expect.arrayContaining(['/intelligence', '/maps', '/alerts', '/networks']));
  expect(getWorkspaceNavigation({ role: 'DISTRICT_LEADERSHIP' }).workspaceLabel).toBe('Jurisdiction Intelligence Pulse');
  expect(paths('DISTRICT_LEADERSHIP')).not.toContain('/admin');
});

test('analyst and station navigation expose work tools without governance controls', () => {
  expect(getWorkspaceNavigation({ role: 'CRIME_ANALYST' }).workspaceLabel).toBe('Analyst Workbench');
  expect(paths('CRIME_ANALYST')).toEqual(expect.arrayContaining(['/reports', '/dashboards', '/networks']));
  expect(getWorkspaceNavigation({ role: 'STATION_OPERATIONS' }).workspaceLabel).toBe('Operational Intelligence');
  expect(paths('STATION_OPERATIONS')).not.toContain('/admin/personas');
});

test('administrator and auditor receive governance navigation without case intelligence', () => {
  expect(paths('PLATFORM_ADMIN')).toEqual(['/', '/admin', '/admin/personas']);
  expect(paths('AUDITOR')).toEqual(['/', '/audit']);
  expect(paths('PLATFORM_ADMIN')).not.toContain('/networks');
});

test('demo presenter starts at the safe persona directory and cannot invent a production permission', () => {
  const navigation = getWorkspaceNavigation({ role: 'DEMO_PRESENTER' });
  expect(navigation.home).toBe('/admin/personas');
  expect(navigation.modules.map(item => item.to)).toEqual(['/admin/personas', '/command-centre']);
});
