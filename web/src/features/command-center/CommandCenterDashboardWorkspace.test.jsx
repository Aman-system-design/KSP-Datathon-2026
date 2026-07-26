import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('./useCommandCenterDashboard.js', () => ({
  useCommandCenterDashboard: () => ({ dashboard: { id: 'D-1', name: 'State overview', tabs: [] }, dashboards: [], activeTab: 'overview', editing: false, saving: false, loading: false, selectTab: vi.fn(), beginEdit: vi.fn(), saveItems: vi.fn(), cancelEdit: vi.fn(), stageItems: vi.fn(), refreshReport: vi.fn(), selectDashboard: vi.fn(), addReport: vi.fn() }),
}));
vi.mock('./CommandCenterDashboardCanvas.jsx', () => ({ CommandCenterDashboardCanvas: () => <div>Canvas</div> }));
vi.mock('./CommandCenterAddReportDrawer.jsx', () => ({ CommandCenterAddReportDrawer: () => null }));
vi.mock('./CommandCenterDashboardPicker.jsx', () => ({ CommandCenterDashboardPicker: () => null }));

import { CommandCenterDashboardWorkspace } from './CommandCenterDashboardWorkspace.jsx';

afterEach(cleanup);

function enterPresentation() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Dashboard actions' }), { button: 0, ctrlKey: false });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Present' }));
}

test('keeps a visible exit action in presentation mode', () => {
  render(<CommandCenterDashboardWorkspace api={{}} workspace={{}} />);
  enterPresentation();
  expect(screen.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Exit presentation' })).toHaveAttribute('aria-keyshortcuts', 'Escape');
  expect(screen.getByText('Esc')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Exit presentation' }));
  expect(screen.queryByRole('button', { name: 'Exit presentation' })).not.toBeInTheDocument();
});

test('Escape exits presentation mode', () => {
  render(<CommandCenterDashboardWorkspace api={{}} workspace={{}} />);
  enterPresentation();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: 'Exit presentation' })).not.toBeInTheDocument();
});
