import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterDashboardCanvas } from './CommandCenterDashboardCanvas.jsx';

afterEach(cleanup);

test('renders an honest empty dashboard with creation paths', () => {
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={{ id: 'D-1', tabs: [{ id: 'overview', items: [] }] }} activeTab="overview" /></MemoryRouter>);
  expect(screen.getByText('This dashboard has no reports yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open report library' })).toHaveAttribute('href', '/reports');
  expect(screen.getByRole('link', { name: 'Create report' })).toHaveAttribute('href', '/reports/new');
  expect(screen.queryByText(/incident count|hotspot|priority alert/i)).not.toBeInTheDocument();
});

test('keeps the unselected canvas addressable for workspace status', () => {
  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={null} /></MemoryRouter>);
  expect(screen.getByTestId('command-center-canvas')).toHaveTextContent('No dashboard selected');
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
