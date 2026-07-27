import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useCommandCenterDashboard } from './useCommandCenterDashboard.js';

const workspace = {
  landingDashboard: { id: 'D-1' },
  availableDashboards: [{ id: 'D-1', name: 'State overview', relationship: 'SYSTEM' }],
};

test('prefers State Crime Intelligence over a stale Station Operations landing dashboard', async () => {
  const leadershipWorkspace = {
    role: 'COMMAND_CENTER',
    landingDashboard: { id: 'D-STATION', name: 'Station Operations' },
    availableDashboards: [
      { id: 'D-STATION', name: 'Station Operations' },
      { id: 'D-STATE', name: 'State Crime Intelligence' },
    ],
  };
  const api = {
    get: vi.fn(async path => ({ data: { id: path.endsWith('D-STATE') ? 'D-STATE' : 'D-STATION', name: 'State Crime Intelligence', items: [] } })),
    post: vi.fn(), put: vi.fn(),
  };

  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace: leadershipWorkspace }));
  await waitFor(() => expect(result.current.dashboard?.id).toBe('D-STATE'));
  expect(api.get).toHaveBeenCalledWith('/v1/dashboards/D-STATE');
  expect(api.get).not.toHaveBeenCalledWith('/v1/dashboards/D-STATION');
});

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
      return { data: { definition: { name: 'Crime trend', definition: { visualization: { type: 'line' } } }, result: { data: { items: [{ day: '2026-07-24', case_count: 12 }] } } } };
    }),
    put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dashboard.items[0]).toMatchObject({ status: 'ready', title: 'Crime trend' });
  expect(result.current.dashboard.items[1]).toMatchObject({ status: 'error', errorCode: 'REPORT_FAILED' });
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

test('uses the approved submission dataset only for an empty synthetic governed result', async () => {
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'State overview', items: [{ id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 }] } })),
    post: vi.fn(async () => ({ data: {
      definition: { name: 'Statewide FIR Volume', definition: { dimensions: [], measures: [{ field: 'RecordCount', aggregate: 'sum' }], visualization: { type: 'number' }, style: {} } },
      result: { data: { items: [{ RecordCount_sum: null }] }, meta: { syntheticData: true } },
    } })),
    put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dashboard.items[0]).toMatchObject({ data: [{ RecordCount_sum: 4900 }], syntheticData: true });
});

test('keeps an approved submission report visible when execution temporarily fails', async () => {
  const api = {
    get: vi.fn(async path => ({ data: path === '/v1/dashboards/D-1'
      ? { id: 'D-1', name: 'State overview', items: [{ id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 }] }
      : { id: 'R-1', name: 'Statewide FIR Volume', definition: { dimensions: [], measures: [{ field: 'RecordCount', aggregate: 'sum' }], visualization: { type: 'number' }, style: {} } } })),
    post: vi.fn(async () => { throw Object.assign(new Error('temporary execution failure'), { code: 'INTERNAL_ERROR' }); }),
    put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dashboard.items[0]).toMatchObject({ status: 'ready', title: 'Statewide FIR Volume', data: [{ RecordCount_sum: 4900 }], syntheticData: true });
});

test('adds and removes report placements while editing', async () => {
  const item = { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 };
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'State overview', items: [item] } })),
    post: vi.fn(async () => ({ data: { definition: { name: 'Crime trend', definition: { visualization: { type: 'table' } } }, result: { data: { items: [] } } } })),
    put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.beginEdit());
  act(() => result.current.addReport({ id: 'R-2', name: 'Category share' }));
  expect(result.current.items).toHaveLength(2);
  expect(result.current.items[1]).toMatchObject({ reportId: 'R-2', column: 1, width: 6, height: 4 });
  act(() => result.current.removeReport('I-1'));
  expect(result.current.items.map(value => value.reportId)).toEqual(['R-2']);
});

test('keeps staged edits open when saving fails', async () => {
  const item = { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 };
  const failure = Object.assign(new Error('Save failed'), { code: 'SAVE_FAILED' });
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'State overview', items: [item] } })),
    post: vi.fn(async () => ({ data: { definition: { name: 'Crime trend', definition: { visualization: { type: 'table' } } }, result: { data: { items: [] } } } })),
    put: vi.fn(async () => { throw failure; }),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.beginEdit());
  act(() => result.current.stageItems([{ ...item, width: 5 }]));
  await act(() => result.current.saveItems());
  expect(result.current.editing).toBe(true);
  expect(result.current.items[0].width).toBe(5);
  expect(result.current.error).toBe(failure);
});

test('loads a landing dashboard that arrives after the first render', async () => {
  const api = {
    get: vi.fn(async path => ({ data: { id: path.endsWith('D-2') ? 'D-2' : 'D-1', name: 'State overview', items: [] } })),
    post: vi.fn(), put: vi.fn(),
  };
  const { result, rerender } = renderHook(({ activeWorkspace }) => useCommandCenterDashboard({ api, workspace: activeWorkspace }), {
    initialProps: { activeWorkspace: { availableDashboards: [] } },
  });
  expect(result.current.loading).toBe(false);
  rerender({ activeWorkspace: { landingDashboard: { id: 'D-2' }, availableDashboards: [{ id: 'D-2' }] } });
  await waitFor(() => expect(result.current.dashboard?.id).toBe('D-2'));
  expect(api.get).toHaveBeenCalledWith('/v1/dashboards/D-2');
});
