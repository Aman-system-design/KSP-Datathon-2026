import { expect, test } from 'vitest';

import { dashboardSections, normalizeDashboard, placementStyle } from './command-center-dashboard-model.js';

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
