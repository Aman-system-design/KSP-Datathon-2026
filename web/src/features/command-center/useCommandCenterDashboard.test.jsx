import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useCommandCenterDashboard } from './useCommandCenterDashboard.js';

const workspace = {
  landingDashboard: { id: 'D-1' },
  availableDashboards: [{ id: 'D-1', name: 'State overview', relationship: 'SYSTEM' }],
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
      return { data: { definition: { name: 'Crime trend', definition: { dimensions: ['day'], measures: [{ field: 'case', aggregate: 'count' }], visualization: { type: 'line' } } }, result: { data: { items: [{ day: '2026-07-24', case_count: 12 }] }, meta: { provenance: 'viewer-scoped' } }, syntheticData: true } };
    }),
    put: vi.fn(),
  };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dashboard.items[0]).toMatchObject({
    status: 'ready', title: 'Crime trend', syntheticData: true,
    definition: { dimensions: ['day'], visualization: { type: 'line' } },
    provenance: 'viewer-scoped',
  });
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
