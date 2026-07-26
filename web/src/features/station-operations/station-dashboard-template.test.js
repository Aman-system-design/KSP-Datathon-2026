import { describe, expect, test, vi } from 'vitest';

import {
  bootstrapStationOperationsDashboard, createStationReports, STATION_BOOTSTRAP_MARKER,
  STATION_LAYOUT, STATION_REPORTS,
} from './station-dashboard-template.js';

const approvedFields = {
  alerts: new Set(['state', 'recordCount']),
  stationCases: new Set([
    'caseId', 'caseNumber', 'unitId', 'unitName', 'status', 'registeredAt', 'incidentAt',
    'incidentHour', 'majorHead', 'minorHead', 'ageDays', 'registeredAgeDays',
    'ageingBucket', 'isOpen', 'recordCount',
  ]),
};

function overlaps(left, right) {
  return left.column < right.column + right.width
    && left.column + left.width > right.column
    && left.row < right.row + right.height
    && left.row + left.height > right.row;
}

describe('station dashboard template', () => {
  test('declares exactly nine governed report definitions without seeded results', () => {
    expect(STATION_REPORTS).toHaveLength(9);
    expect(STATION_REPORTS.map(report => report.name)).toEqual([
      'Open Cases', '60+ Day Cases', 'New Cases · Last 30 Days', 'Active Alerts',
      'Case Ageing', 'Case Lifecycle', 'Crime Category', '24-Hour Incident Pattern',
      'Open Case Register',
    ]);
    expect(STATION_REPORTS.map(report => report.sourceKey)).toEqual([
      'stationCases', 'stationCases', 'stationCases', 'alerts', 'stationCases',
      'stationCases', 'stationCases', 'stationCases', 'stationCases',
    ]);
    for (const report of STATION_REPORTS) {
      expect(report).not.toHaveProperty('data');
      expect(report).not.toHaveProperty('result');
      expect(report).not.toHaveProperty('preview');
      expect(JSON.stringify(report)).not.toMatch(/synthetic|seeded/i);
    }
  });

  test('uses truthful approved dimensions, measures, and lifecycle filters', () => {
    for (const report of STATION_REPORTS) {
      const fields = [
        ...(report.dimensions ?? []),
        ...(report.measures ?? []).map(measure => measure.field),
        ...(report.filters ?? []).map(filter => filter.field),
      ];
      expect(fields.every(field => approvedFields[report.sourceKey].has(field))).toBe(true);
    }
    expect(STATION_REPORTS[0]).toMatchObject({
      filters: [{ field: 'isOpen', operator: 'eq', value: true }],
      measures: [{ field: 'recordCount', aggregate: 'sum' }],
      visualization: { type: 'number' },
    });
    expect(STATION_REPORTS[1].filters).toEqual([
      { field: 'isOpen', operator: 'eq', value: true },
      { field: 'ageingBucket', operator: 'eq', value: '60+ days' },
    ]);
    expect(STATION_REPORTS[2]).toMatchObject({
      dimensions: [], measures: [{ field: 'recordCount', aggregate: 'sum' }],
      filters: [{ field: 'registeredAgeDays', operator: 'lte', value: 30 }],
      visualization: { type: 'number' },
    });
    expect(STATION_REPORTS[3].filters).toEqual([
      { field: 'state', operator: 'in', value: ['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED'] },
    ]);
    expect(STATION_REPORTS[4]).toMatchObject({
      dimensions: ['ageingBucket'],
      filters: [{ field: 'isOpen', operator: 'eq', value: true }],
      visualization: { type: 'bar' },
    });
    expect(STATION_REPORTS[5]).toMatchObject({ dimensions: ['status'], filters: [], visualization: { type: 'funnel' } });
    expect(STATION_REPORTS[7]).toMatchObject({
      dimensions: ['incidentHour'],
      filters: [{ field: 'incidentHour', operator: 'gte', value: 0 }],
      visualization: { type: 'line' },
    });
    expect(STATION_REPORTS[8]).toMatchObject({ visualization: { type: 'table' }, filters: [{ field: 'isOpen', operator: 'eq', value: true }] });
  });

  test('places every report within a non-overlapping twelve-column layout', () => {
    expect(STATION_LAYOUT).toHaveLength(STATION_REPORTS.length);
    for (const placement of STATION_LAYOUT) {
      expect(Number.isInteger(placement.column)).toBe(true);
      expect(Number.isInteger(placement.row)).toBe(true);
      expect(Number.isInteger(placement.width)).toBe(true);
      expect(Number.isInteger(placement.height)).toBe(true);
      expect(placement.column).toBeGreaterThanOrEqual(1);
      expect(placement.row).toBeGreaterThanOrEqual(1);
      expect(placement.width).toBeGreaterThanOrEqual(1);
      expect(placement.height).toBeGreaterThanOrEqual(1);
      expect(placement.column + placement.width - 1).toBeLessThanOrEqual(12);
    }
    for (let left = 0; left < STATION_LAYOUT.length; left += 1) {
      for (let right = left + 1; right < STATION_LAYOUT.length; right += 1) {
        expect(overlaps(STATION_LAYOUT[left], STATION_LAYOUT[right]), `${left} overlaps ${right}`).toBe(false);
      }
    }
    expect(STATION_LAYOUT[4].width).toBeGreaterThanOrEqual(6);
    expect(STATION_LAYOUT[8].height).toBeGreaterThanOrEqual(4);
  });

  test('deeply freezes report definitions and layout placements', () => {
    expect(Object.isFrozen(STATION_REPORTS[0].filters)).toBe(true);
    expect(Object.isFrozen(STATION_REPORTS[0].filters[0])).toBe(true);
    expect(Object.isFrozen(STATION_REPORTS[0].visualization)).toBe(true);
    expect(Object.isFrozen(STATION_LAYOUT[0])).toBe(true);
    expect(() => { STATION_REPORTS[0].filters[0].value = false; }).toThrow(TypeError);
    expect(() => { STATION_REPORTS[0].visualization.type = 'table'; }).toThrow(TypeError);
    expect(() => { STATION_LAYOUT[0].width = 12; }).toThrow(TypeError);
    expect(STATION_REPORTS[0].filters[0].value).toBe(true);
    expect(STATION_LAYOUT[0].width).toBe(3);
  });

  test('creates immutable selected-period definitions for approved period options', () => {
    const periods = [7, 30, 90].map(periodDays => createStationReports({ periodDays }));
    expect(periods.map(reports => reports[2].name)).toEqual([
      'New Cases · Last 7 Days', 'New Cases · Last 30 Days', 'New Cases · Last 90 Days',
    ]);
    expect(periods.map(reports => reports[2].filters[0].value)).toEqual([7, 30, 90]);
    expect(periods[0][2].description).toMatch(/active selected 7-day period/i);
    expect(Object.isFrozen(periods[0][2].filters[0])).toBe(true);
    expect(STATION_REPORTS[2]).toEqual(periods[1][2]);
    for (const periodDays of [0, 14, 365, '30', null]) {
      expect(() => createStationReports({ periodDays })).toThrow(TypeError);
    }
  });

  test('bootstraps the nine reports, private dashboard, placements, and personal landing once', async () => {
    const state = { reports: [], dashboards: [], landingDashboard: null, nextReport: 1 };
    const api = stationBootstrapApi(state);

    const first = await bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace });
    const second = await bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace });

    expect(first.dashboard).toMatchObject({ id: 'D-STATION-BOOTSTRAP', name: 'Station Operations', relationship: 'OWNED' });
    expect(second.dashboard.id).toBe(first.dashboard.id);
    expect(state.reports).toHaveLength(9);
    expect(state.dashboards).toHaveLength(1);
    expect(state.dashboards[0].items).toEqual(STATION_LAYOUT.map((layout, index) => ({
      reportId: `R-${index + 1}`, ...layout,
    })));
    expect(state.landingDashboard).toBe('D-STATION-BOOTSTRAP');
    expect(api.post.mock.calls.filter(([path]) => path === '/v1/reports')).toHaveLength(9);
    expect(api.post.mock.calls.filter(([path]) => path === '/v1/dashboards')).toHaveLength(1);
    expect(api.put.mock.calls.filter(([path]) => path.endsWith('/items'))).toHaveLength(1);
    expect(api.idempotent).toHaveBeenCalledWith('/v1/reports', STATION_REPORTS[0], 'station-operations/v1/report/0');
    expect(api.idempotent).toHaveBeenCalledWith('/v1/dashboards', expect.objectContaining({ description: '[ACE:station-operations:v1:pending]' }), 'station-operations/v1/dashboard');
  });

  test('recovers write-then-throw report, dashboard, placement, and landing mutations by reconciliation', async () => {
    const state = { reports: [], dashboards: [], landingDashboard: null, nextReport: 1 };
    const api = stationBootstrapApi(state, { throwAfterWrite: new Set(['report', 'dashboard', 'items', 'landing']) });

    const result = await bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace });

    expect(result.reports).toHaveLength(9);
    expect(result.dashboard.id).toBe('D-STATION-BOOTSTRAP');
    expect(state.reports).toHaveLength(9);
    expect(state.dashboards[0].items).toHaveLength(9);
    expect(state.landingDashboard).toBe('D-STATION-BOOTSTRAP');
  });

  test('coalesces concurrent setup attempts so remounts cannot duplicate content', async () => {
    const state = { reports: [], dashboards: [], landingDashboard: null, nextReport: 1 };
    const api = stationBootstrapApi(state);

    const [first, second] = await Promise.all([
      bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace }),
      bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace }),
    ]);

    expect(first.dashboard.id).toBe(second.dashboard.id);
    expect(state.reports).toHaveLength(9);
    expect(state.dashboards).toHaveLength(1);
  });

  test('fails closed for other personas and preserves an existing station role default', async () => {
    const state = { reports: [], dashboards: [], landingDashboard: null, nextReport: 1 };
    const api = stationBootstrapApi(state);
    await expect(bootstrapStationOperationsDashboard({
      api, workspace: { ...emptyStationWorkspace, role: 'STATE_LEADERSHIP' },
    })).rejects.toThrow('Station Operations');
    expect(api.get).not.toHaveBeenCalled();

    const system = { id: 'D-SYSTEM', name: 'Station Operations', relationship: 'SYSTEM', defaultRole: 'STATION_OPERATIONS' };
    const preserved = await bootstrapStationOperationsDashboard({
      api, workspace: { ...emptyStationWorkspace, landingDashboard: system, availableDashboards: [system] },
    });
    expect(preserved.dashboard).toBe(system);
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('preserves a role default discovered during reconciliation without rewriting it', async () => {
    const system = { id: 'D-SYSTEM', name: 'Station Operations', relationship: 'SYSTEM', defaultRole: 'STATION_OPERATIONS', items: [] };
    const state = { reports: [], dashboards: [system], landingDashboard: null, nextReport: 1 };
    const api = stationBootstrapApi(state);

    const result = await bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace });

    expect(result.dashboard.id).toBe('D-SYSTEM');
    expect(api.post.mock.calls.filter(([path]) => path === '/v1/dashboards')).toHaveLength(0);
    expect(api.put).not.toHaveBeenCalled();
  });

  test('does not adopt same-name wrong-definition reports or overwrite an unmarked user dashboard', async () => {
    const wrong = { id: 'R-WRONG', name: 'Open Cases', definition: { ...structuredClone(STATION_REPORTS[0]), filters: [] }, relationship: 'OWNED' };
    const custom = { id: 'D-CUSTOM', name: 'Station Operations', description: 'My edited workspace', relationship: 'OWNED', items: [{ id: 'CUSTOM-I', reportId: wrong.id, column: 1, row: 1, width: 12, height: 8 }] };
    const state = { reports: [wrong], dashboards: [custom], landingDashboard: custom.id, nextReport: 1 };
    const api = stationBootstrapApi(state);

    const result = await bootstrapStationOperationsDashboard({ api, workspace: emptyStationWorkspace });

    expect(result.reports[0].id).not.toBe(wrong.id);
    expect(result.dashboard.id).not.toBe(custom.id);
    expect(state.dashboards.find(item => item.id === custom.id).items).toEqual(custom.items);
    expect(api.put).not.toHaveBeenCalledWith(`/v1/dashboards/${custom.id}/items`, expect.anything());
    expect(result.dashboard.description).toBe(STATION_BOOTSTRAP_MARKER);
  });

  test('a fresh client reconciles a marked partial bootstrap without duplicate resources', async () => {
    const state = { reports: [], dashboards: [], landingDashboard: null, nextReport: 1 };
    const firstApi = stationBootstrapApi(state, { failItemsOnce: true });
    await expect(bootstrapStationOperationsDashboard({ api: firstApi, workspace: emptyStationWorkspace })).rejects.toThrow();

    const freshApi = stationBootstrapApi(state);
    const result = await bootstrapStationOperationsDashboard({ api: freshApi, workspace: emptyStationWorkspace });

    expect(result.reports).toHaveLength(9);
    expect(state.reports).toHaveLength(9);
    expect(state.dashboards).toHaveLength(1);
    expect(state.dashboards[0].items).toHaveLength(9);
    expect(state.landingDashboard).toBe(result.dashboard.id);
  });
});

const emptyStationWorkspace = {
  role: 'STATION_OPERATIONS', availableReports: [], availableDashboards: [],
};

function stationBootstrapApi(state, { throwAfterWrite = new Set(), failItemsOnce = false } = {}) {
  const thrown = new Set();
  const maybeThrow = kind => {
    if (throwAfterWrite.has(kind) && !thrown.has(kind)) {
      thrown.add(kind);
      throw new Error(`${kind} response lost`);
    }
  };
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/reports') return { data: structuredClone(state.reports) };
      if (path === '/v1/dashboards') return { data: structuredClone(state.dashboards.map(({ items: _items, ...dashboard }) => dashboard)) };
      if (path === '/v1/workspace') return { data: { landingDashboard: state.dashboards.find(item => item.id === state.landingDashboard) } };
      if (path.startsWith('/v1/dashboards/')) return { data: structuredClone(state.dashboards.find(item => item.id === decodeURIComponent(path.split('/').at(-1)))) };
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path, body) => {
      if (path === '/v1/reports') {
        const report = { id: `R-${state.nextReport++}`, name: body.name, definition: structuredClone(body), relationship: 'OWNED' };
        state.reports.push(report);
        maybeThrow('report');
        return { data: structuredClone(report) };
      }
      if (path === '/v1/dashboards') {
        const dashboard = { id: 'D-STATION-BOOTSTRAP', ...body, relationship: 'OWNED', visibility: 'PRIVATE', version: 1, items: [] };
        state.dashboards.push(dashboard);
        maybeThrow('dashboard');
        const { relationship: _relationship, ...created } = dashboard;
        return { data: structuredClone(created) };
      }
      throw new Error(`Unexpected POST ${path}`);
    }),
    put: vi.fn(async (path, body) => {
      if (path.startsWith('/v1/dashboards/') && path.endsWith('/items')) {
        const id = decodeURIComponent(path.split('/')[3]);
        const dashboard = state.dashboards.find(item => item.id === id);
        if (failItemsOnce && !thrown.has('items-before')) {
          thrown.add('items-before');
          throw new Error('items unavailable');
        }
        dashboard.items = structuredClone(body.items);
        maybeThrow('items');
        return { data: structuredClone(body.items) };
      }
      if (path === '/v1/preferences/landing-dashboard') {
        state.landingDashboard = body.dashboardId;
        maybeThrow('landing');
        return { data: { landingDashboardId: body.dashboardId } };
      }
      throw new Error(`Unexpected PUT ${path}`);
    }),
    patch: vi.fn(async (path, body) => {
      const dashboard = state.dashboards.find(item => item.id === decodeURIComponent(path.split('/').at(-1)));
      dashboard.name = body.name;
      dashboard.description = body.description;
      dashboard.version += 1;
      return { data: structuredClone(dashboard) };
    }),
  };
  api.idempotent = vi.fn((path, body) => api.post(path, body));
  return api;
}
