import { expect, test } from 'vitest';

import { compactDashboardItems, dashboardSections, normalizeDashboard, placementStyle } from './command-center-dashboard-model.js';

test('groups only authorized dashboard summaries by relationship', () => {
  const sections = dashboardSections([
    { id: 'D-1', name: 'State overview', relationship: 'SYSTEM' },
    { id: 'D-2', name: 'Night crime', relationship: 'OWNED' },
    { id: 'D-3', name: 'Election watch', relationship: 'SHARED' },
  ]);
  expect(sections.system.map(item => item.id)).toEqual(['D-1']);
  expect(sections.owned.map(item => item.id)).toEqual(['D-2']);
  expect(sections.shared.map(item => item.id)).toEqual(['D-3']);
});

test('normalizes legacy dashboard items into the overview tab', () => {
  const dashboard = normalizeDashboard({ id: 'D-1', name: 'State overview', items: [
    { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 4, height: 3 },
  ] });
  expect(dashboard.tabs[0].id).toBe('overview');
  expect(dashboard.tabs[0].items[0].reportId).toBe('R-1');
});

test('converts a twelve-column placement into bounded percentages', () => {
  expect(placementStyle({ column: 4, row: 2, width: 3, height: 2 })).toEqual({
    left: '25%', width: '25%', top: '96px', height: '192px',
  });
});

test('compacts reports into the first available grid positions without changing dimensions', () => {
  const items = [
    { id: 'top-left', column: 1, row: 1, width: 7, height: 5 },
    { id: 'from-below', column: 1, row: 6, width: 5, height: 5 },
    { id: 'next-row', column: 7, row: 6, width: 6, height: 4 },
  ];

  expect(compactDashboardItems(items)).toEqual([
    { id: 'top-left', column: 1, row: 1, width: 7, height: 5 },
    { id: 'from-below', column: 8, row: 1, width: 5, height: 5 },
    { id: 'next-row', column: 1, row: 6, width: 6, height: 4 },
  ]);
});

test('sorts by saved visual order and does not mutate dashboard items', () => {
  const items = [
    { id: 'lower', column: 7, row: 5, width: 6, height: 3 },
    { id: 'upper', column: 1, row: 1, width: 6, height: 3 },
  ];
  const snapshot = structuredClone(items);

  expect(compactDashboardItems(items).map(item => item.id)).toEqual(['upper', 'lower']);
  expect(compactDashboardItems(items).map(({ column, row, width, height }) => ({ column, row, width, height }))).toEqual([
    { column: 1, row: 1, width: 6, height: 3 },
    { column: 7, row: 1, width: 6, height: 3 },
  ]);
  expect(items).toEqual(snapshot);
});

test('fails open when any placement has invalid grid dimensions', () => {
  const items = [
    { id: 'valid', column: 7, row: 4, width: 6, height: 3 },
    { id: 'invalid', column: 1, row: 1, width: 13, height: 3 },
  ];

  expect(compactDashboardItems(items)).toEqual(items);
});
