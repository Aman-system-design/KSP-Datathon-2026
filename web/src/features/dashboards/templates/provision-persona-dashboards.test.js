import { expect, test, vi } from 'vitest';

import { provisionPersonaDashboards, templatesForWorkspace } from './provision-persona-dashboards.js';

function apiFixture(role = 'CRIME_ANALYST') {
  const state = { reports: [], dashboards: [], items: new Map() };
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/reports') return { data: state.reports };
      if (path === '/v1/dashboards') return { data: state.dashboards };
      if (path === '/v1/workspace') return { data: { role, availableReports: state.reports, availableDashboards: state.dashboards } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    idempotent: vi.fn(async (path, body) => {
      if (path === '/v1/reports') {
        const value = { id: `R-${state.reports.length + 1}`, name: body.name, definition: body, relationship: 'OWNED' };
        state.reports.push(value); return { data: value };
      }
      const value = { id: `D-${state.dashboards.length + 1}`, ...body, relationship: 'OWNED', version: 1 };
      state.dashboards.push(value); return { data: value };
    }),
    idempotentPut: vi.fn(async path => { state.items.set(path, true); return { data: {} }; }),
    patch: vi.fn(async (path, body) => {
      const id = decodeURIComponent(path.split('/').at(-1));
      const index = state.dashboards.findIndex(value => value.id === id);
      state.dashboards[index] = { ...state.dashboards[index], ...body, version: 2 };
      return { data: state.dashboards[index] };
    }),
  };
  return { api, state };
}

test('selects only the template whose semantic sources match the active persona', () => {
  expect(templatesForWorkspace({ role: 'DISTRICT_LEADERSHIP' }).map(value => value.name)).toEqual(['District Intelligence Dashboard']);
  expect(templatesForWorkspace({ role: 'CRIME_ANALYST' }).map(value => value.name)).toEqual(['Crime Analyst Dashboard']);
  expect(templatesForWorkspace({ role: 'STATION_OPERATIONS' }).map(value => value.name)).toEqual(['Police Station Dashboard']);
  expect(templatesForWorkspace({ role: 'COMMAND_CENTER' })).toEqual([]);
});

test('provisions the authorized template and returns the refreshed workspace', async () => {
  const { api } = apiFixture();
  const result = await provisionPersonaDashboards({ api, workspace: { role: 'CRIME_ANALYST', availableDashboards: [] } });
  expect(result.warnings).toEqual([]);
  expect(result.workspace.availableDashboards).toEqual([
    expect.objectContaining({ name: 'Crime Analyst Dashboard', description: '[ACE:crime-analyst:v1:complete]' }),
  ]);
  expect(api.get).toHaveBeenLastCalledWith('/v1/workspace');
});

test('keeps the original workspace usable when provisioning fails', async () => {
  const workspace = { role: 'CRIME_ANALYST', availableDashboards: [] };
  const api = { get: vi.fn(async path => {
    if (path === '/v1/reports') throw new Error('offline');
    if (path === '/v1/workspace') return { data: workspace };
    return { data: [] };
  }) };
  const result = await provisionPersonaDashboards({ api, workspace });
  expect(result.workspace).toEqual(workspace);
  expect(result.warnings).toHaveLength(1);
});
