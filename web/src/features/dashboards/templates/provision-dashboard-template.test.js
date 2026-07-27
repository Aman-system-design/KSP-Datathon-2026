import { expect, test, vi } from 'vitest';

import { DISTRICT_DASHBOARD_TEMPLATE as template } from './district-dashboard-template.js';
import { provisionDashboardTemplate } from './provision-dashboard-template.js';

function fakeApi({ completed = false } = {}) {
  const state = { reports: [], dashboards: [], items: [] };
  if (completed) state.dashboards.push({
    id: 'D-1', name: template.name, description: template.description, relationship: 'OWNED', version: 2,
  });
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/reports') return { data: state.reports };
      if (path === '/v1/dashboards') return { data: state.dashboards };
      if (path.startsWith('/v1/dashboards/')) return { data: { ...state.dashboards[0], items: state.items } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    idempotent: vi.fn(async (path, body) => {
      if (path === '/v1/reports') {
        const report = { id: `R-${state.reports.length + 1}`, name: body.name, definition: body, relationship: 'OWNED' };
        state.reports.push(report);
        return { data: report };
      }
      const dashboard = { id: 'D-1', ...body, relationship: 'OWNED', version: 1 };
      state.dashboards.push(dashboard);
      return { data: dashboard };
    }),
    idempotentPut: vi.fn(async (_path, body) => { state.items = body.items; return { data: body }; }),
    patch: vi.fn(async (_path, body) => {
      state.dashboards[0] = { ...state.dashboards[0], ...body, version: 2 };
      return { data: state.dashboards[0] };
    }),
  };
  return { api, state };
}

test('creates canonical reports and one owned dashboard', async () => {
  const { api, state } = fakeApi();
  const result = await provisionDashboardTemplate({ api, template, reports: [], dashboards: [] });
  expect(result.dashboard).toMatchObject({ name: template.name, description: template.description, relationship: 'OWNED' });
  expect(state.reports).toHaveLength(template.reports.length);
  expect(state.items).toEqual(template.layout.map((placement, index) => ({ reportId: `R-${index + 1}`, ...placement })));
});

test('returns a completed dashboard without replacing user placements', async () => {
  const { api } = fakeApi({ completed: true });
  const result = await provisionDashboardTemplate({ api, template, reports: [], dashboards: [] });
  expect(result.dashboard.id).toBe('D-1');
  expect(api.idempotentPut).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

test('shares an in-flight operation for concurrent calls using the same api and template', async () => {
  const { api, state } = fakeApi();
  const [left, right] = await Promise.all([
    provisionDashboardTemplate({ api, template, reports: [], dashboards: [] }),
    provisionDashboardTemplate({ api, template, reports: [], dashboards: [] }),
  ]);
  expect(left.dashboard.id).toBe(right.dashboard.id);
  expect(state.dashboards).toHaveLength(1);
  expect(state.reports).toHaveLength(template.reports.length);
});
