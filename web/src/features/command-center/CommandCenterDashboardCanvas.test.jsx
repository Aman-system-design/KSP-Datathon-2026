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
    { id: 'overview', items: [{ id: 'I-1', reportId: 'R-1', title: 'Governed result', status: 'ready', data: [{ count: 1 }], column: 1, row: 1, width: 6, height: 3 }] },
    { id: 'other', items: [{ id: 'I-2', reportId: 'R-2', title: 'Other result', status: 'ready', data: [{ count: 2 }], column: 1, row: 1, width: 6, height: 3 }] },
  ] };
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} activeTab="overview" /></MemoryRouter>);
  expect(screen.getByLabelText('Governed result')).toBeInTheDocument();
  expect(screen.queryByLabelText('Other result')).not.toBeInTheDocument();
});

test('hides successful zero-row reports while keeping non-empty zero values and failures', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'I-empty', reportId: 'R-empty', title: 'Empty evidence', status: 'ready', data: [], column: 1, row: 1, width: 4, height: 3 },
    { id: 'I-zero', reportId: 'R-zero', title: 'Zero is evidence', status: 'ready', data: [{ count: 0 }], column: 5, row: 1, width: 4, height: 3 },
    { id: 'I-error', reportId: 'R-error', title: 'Unavailable evidence', status: 'error', data: [], column: 9, row: 1, width: 4, height: 3 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} /></MemoryRouter>);

  expect(screen.queryByLabelText('Empty evidence')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Zero is evidence')).toBeInTheDocument();
  expect(screen.getByLabelText('Unavailable evidence')).toBeInTheDocument();
});

test('keeps successful empty reports addressable while editing', () => {
  const report = { id: 'I-empty', reportId: 'R-empty', title: 'Empty evidence', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 };
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [report] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} editing /></MemoryRouter>);

  expect(screen.getByLabelText('Empty evidence')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drag Empty evidence' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove Empty evidence report' })).toBeInTheDocument();
});

test('summarizes a configured dashboard when every report has zero rows', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'I-empty', reportId: 'R-empty', title: 'Empty evidence', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} /></MemoryRouter>);

  expect(screen.getByText('No reports currently have matching records.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open report library' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Create report' })).not.toBeInTheDocument();
});

test('fills a hidden report gap with the next visible report', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'left', reportId: 'R-left', title: 'Left report', status: 'ready', data: [{ count: 1 }], column: 1, row: 1, width: 7, height: 5 },
    { id: 'empty', reportId: 'R-empty', title: 'Empty report', status: 'ready', data: [], column: 8, row: 1, width: 5, height: 5 },
    { id: 'lower', reportId: 'R-lower', title: 'Lower report', status: 'ready', data: [{ count: 0 }], column: 1, row: 6, width: 5, height: 5 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} /></MemoryRouter>);

  const placement = screen.getByLabelText('Lower report').closest('.command-center-dashboard-placement');
  expect(screen.queryByLabelText('Empty report')).not.toBeInTheDocument();
  expect(placement).toHaveStyle({ left: `${(7 / 12) * 100}%`, top: '0px', width: `${(5 / 12) * 100}%`, height: '480px' });
});

test('keeps saved report coordinates while editing instead of compacting', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'left', reportId: 'R-left', title: 'Left report', status: 'ready', data: [{ count: 1 }], column: 1, row: 1, width: 7, height: 5 },
    { id: 'empty', reportId: 'R-empty', title: 'Empty report', status: 'ready', data: [], column: 8, row: 1, width: 5, height: 5 },
    { id: 'lower', reportId: 'R-lower', title: 'Lower report', status: 'ready', data: [{ count: 0 }], column: 1, row: 6, width: 5, height: 5 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} editing /></MemoryRouter>);

  const placement = screen.getByLabelText('Lower report').closest('.command-center-dashboard-placement');
  expect(screen.getByLabelText('Empty report')).toBeInTheDocument();
  expect(placement).toHaveStyle({ left: '0%', top: '480px', width: `${(5 / 12) * 100}%`, height: '480px' });
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
