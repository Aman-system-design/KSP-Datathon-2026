import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterDashboardCanvas, isSuccessfulEmptyReport } from './CommandCenterDashboardCanvas.jsx';

afterEach(cleanup);

test.each([
  [{ status: 'ready', data: [] }, true],
  [{ status: 'ready', data: [{ count: 0 }] }, false],
  [{ status: 'error', data: [] }, false],
  [{ status: 'loading', data: [] }, false],
  [{ status: 'ready' }, false],
  [{ status: 'ready', data: null }, false],
])('classifies only an exact successful zero-row report as empty', (item, expected) => {
  expect(isSuccessfulEmptyReport(item)).toBe(expected);
});

test('renders an honest empty dashboard with creation paths', () => {
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={{ id: 'D-1', tabs: [{ id: 'overview', items: [] }] }} activeTab="overview" /></MemoryRouter>);
  expect(screen.getByText('This dashboard has no reports yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open report library' })).toHaveAttribute('href', '/reports');
  expect(screen.getByRole('link', { name: 'Create report' })).toHaveAttribute('href', '/reports/new');
  expect(screen.queryByText(/incident count|hotspot|priority alert/i)).not.toBeInTheDocument();
});

test('keeps the unselected canvas addressable for workspace status', () => {
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={null} /></MemoryRouter>);
  expect(screen.getByTestId('command-center-canvas')).toHaveTextContent('Intelligence Workspace');
  expect(screen.getByTestId('command-center-canvas')).toHaveTextContent('Create or open a dashboard to compose your operational intelligence view.');
});

test('places only reports belonging to the active tab', () => {
  const dashboard = { id: 'D-1', tabs: [
    { id: 'overview', items: [{ id: 'I-1', reportId: 'R-1', title: 'Governed result', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 }] },
    { id: 'other', items: [{ id: 'I-2', reportId: 'R-2', title: 'Other result', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 }] },
  ] };
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} activeTab="overview" /></MemoryRouter>);
  expect(screen.getByLabelText('Governed result')).toBeInTheDocument();
  expect(screen.queryByLabelText('Other result')).not.toBeInTheDocument();
});

test('stages bounded keyboard movement and resizing while editing', () => {
  const onStage = vi.fn();
  const report = { id: 'I-1', reportId: 'R-1', title: 'Governed result', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 };
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [report] }] };
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} activeTab="overview" editing onStage={onStage} /></MemoryRouter>);

  fireEvent.click(screen.getByRole('button', { name: 'Move Governed result right' }));
  expect(onStage).toHaveBeenLastCalledWith([{ ...report, column: 2 }]);

  fireEvent.click(screen.getByRole('button', { name: 'Make Governed result wider' }));
  expect(onStage).toHaveBeenLastCalledWith([{ ...report, width: 7 }]);
});

test('exposes pointer drag and resize handles while editing', () => {
  const report = { id: 'I-1', reportId: 'R-1', title: 'Governed result', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 };
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [report] }] };
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} activeTab="overview" editing /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Drag Governed result' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resize Governed result' })).toBeInTheDocument();
});

test('renders staged item dimensions immediately instead of stale tab placements', () => {
  const stale = { id: 'I-1', reportId: 'R-1', title: 'Governed result', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 };
  const staged = { ...stale, width: 9, height: 5 };
  const dashboard = { id: 'D-1', items: [staged], tabs: [{ id: 'overview', items: [stale] }] };
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} activeTab="overview" editing /></MemoryRouter>);
  const placement = screen.getByLabelText('Governed result').closest('.command-center-dashboard-placement');
  expect(placement).toHaveStyle({ width: '75%', height: '480px' });
});
