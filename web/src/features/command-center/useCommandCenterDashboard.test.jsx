import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useCommandCenterDashboard } from './useCommandCenterDashboard.js';

const workspace = {
  landingDashboard: { id: 'D-1' },
  availableDashboards: [{ id: 'D-1', name: 'State overview', relationship: 'SYSTEM' }],
  availableReports: [{ id: 'R-1', name: 'Crime trend' }, { id: 'R-2', name: 'Active Alerts', definition: { visualization: { type: 'number' } } }],
};

test('loads the landing dashboard and contains one failed report', async () => {
  const api = {
    get: vi.fn(async path => ({ data: path === '/v1/dashboards/D-1' ? {
      id: 'D-1', name: 'State overview', items: [
        { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 },
        { id: 'I-2', reportId: 'R-2', column: 7, row: 1, width: 6, height: 3 },
      ],
    } : [] })),
    post: vi.fn(async path => {
      if (path.includes('R-2')) throw Object.assign(new Error('unavailable'), { code: 'REPORT_FAILED' });
      return { data: { definition: { name: 'Crime trend', definition: { dimensions: ['day'], measures: [{ field: 'case', aggregate: 'count' }], visualization: { type: 'line' } } }, result: { data: { items: [{ day: '2026-07-24', case_count: 12 }] } }, provenance: 'MIXED', syntheticData: false } };
    }),
    put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dashboard.items[0]).toMatchObject({
    status: 'ready', title: 'Crime trend', syntheticData: false,
    definition: { dimensions: ['day'], visualization: { type: 'line' } },
    provenance: 'MIXED',
  });
  expect(result.current.dashboard.items[1]).toMatchObject({ status: 'error', title: 'Active Alerts', errorCode: 'REPORT_FAILED' });
});

test('stages, cancels, and saves dashboard item layouts', async () => {
  const item = { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 };
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'State overview', items: [item] } })),
    post: vi.fn(async () => ({ data: { definition: { name: 'Crime trend', definition: { visualization: { type: 'table' } } }, result: { data: { items: [] } } } })),
    put: vi.fn(async () => ({ data: [] })),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.beginEdit());
  act(() => result.current.stageItems([{ ...item, width: 4 }]));
  expect(result.current.items[0].width).toBe(4);
  act(() => result.current.cancelEdit());
  expect(result.current.items[0].width).toBe(6);
  act(() => result.current.beginEdit());
  act(() => result.current.stageItems([{ ...item, width: 5 }]));
  await act(() => result.current.saveItems());
  expect(api.put).toHaveBeenCalledWith('/v1/dashboards/D-1/items', { items: [
    { reportId: 'R-1', column: 1, row: 1, width: 5, height: 3 },
  ] });
});

test('re-executes reports in parallel with optional ephemeral bodies when the reload key changes', async () => {
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'Station desk', items: [
      { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 },
      { id: 'I-2', reportId: 'R-2', column: 7, row: 1, width: 6, height: 3 },
    ] } })),
    post: vi.fn(async () => ({ data: { definition: { name: 'Cases', definition: { visualization: { type: 'table' } } }, result: { data: { items: [] } } } })),
    put: vi.fn(),
  };
  const executionBody = vi.fn((_reportId, periodDays) => ({
    runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: periodDays }],
  }));
  const { result, rerender } = renderHook(
    ({ periodDays }) => useCommandCenterDashboard({ api, workspace, reloadKey: periodDays, executionBody: reportId => executionBody(reportId, periodDays) }),
    { initialProps: { periodDays: 7 } },
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenCalledWith('/v1/reports/R-1/execute', {
    runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: 7 }],
  });

  rerender({ periodDays: 90 });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(4));
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith('/v1/reports/R-2/execute', {
    runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: 90 }],
  });
});

test('keeps the newest execution context when period responses arrive out of order', async () => {
  const pending = new Map();
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'Station desk', items: [
      { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 },
    ] } })),
    post: vi.fn((_path, body) => new Promise(resolve => pending.set(body.period, resolve))),
    put: vi.fn(),
  };
  const { result, rerender } = renderHook(
    ({ period }) => useCommandCenterDashboard({ api, workspace, reloadKey: period, executionBody: () => ({ period }) }),
    { initialProps: { period: 7 } },
  );
  await waitFor(() => expect(pending.has(7)).toBe(true));
  rerender({ period: 90 });
  await waitFor(() => expect(pending.has(90)).toBe(true));
  await act(() => pending.get(90)({ data: { definition: { name: 'Newest', definition: { visualization: { type: 'table' } } }, result: { data: { items: [{ period: 90 }] } } } }));
  await waitFor(() => expect(result.current.dashboard.items[0].data).toEqual([{ period: 90 }]));
  await act(() => pending.get(7)({ data: { definition: { name: 'Stale', definition: { visualization: { type: 'table' } } }, result: { data: { items: [{ period: 7 }] } } } }));
  expect(result.current.dashboard.items[0].data).toEqual([{ period: 90 }]);
});

test('requested dashboard initializes selection without pinning later picker choices', async () => {
  const pickerWorkspace = {
    ...workspace,
    availableDashboards: [
      { id: 'D-1', name: 'First', relationship: 'SYSTEM' },
      { id: 'D-2', name: 'Second', relationship: 'SYSTEM' },
    ],
  };
  const api = {
    get: vi.fn(async path => ({ data: { id: path.split('/').at(-1), name: path.endsWith('D-2') ? 'Second' : 'First', items: [] } })),
    post: vi.fn(), put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({
    api, workspace: pickerWorkspace, requestedDashboardId: 'D-1',
  }));
  await waitFor(() => expect(result.current.dashboard?.id).toBe('D-1'));

  act(() => result.current.selectDashboard('D-2'));
  await waitFor(() => expect(result.current.dashboard?.id).toBe('D-2'));
  expect(api.get.mock.calls.filter(([path]) => path === '/v1/dashboards/D-1')).toHaveLength(1);
});
