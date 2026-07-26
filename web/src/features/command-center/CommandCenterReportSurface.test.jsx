import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { CommandCenterReportSurface } from './CommandCenterReportSurface.jsx';

test('renders returned governed rows without inventing a metric', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-1', reportId: 'R-1', title: 'District movement', status: 'ready', visualization: 'table', data: [{ district: 'Mysuru', case_count: 12 }] }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'District movement' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Mysuru');
  expect(screen.getByRole('table')).toHaveTextContent('12');
  expect(screen.queryByText('Governed report')).not.toBeInTheDocument();
});

test('contains a failed report with a safe reference', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-2', reportId: 'R-2', title: 'Report unavailable', status: 'error', errorCode: 'REPORT_FAILED' }} /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Reference REPORT_FAILED');
});

test('renders a governed number visualization from its report definition', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-3', reportId: 'R-3', title: 'Statewide FIR Volume', status: 'ready', syntheticData: true, definition: { name: 'Statewide FIR Volume', description: 'Synthetic submission dataset', dimensions: [], measures: [{ field: 'RecordCount', aggregate: 'sum' }], visualization: { type: 'number' }, style: {} }, data: [{ RecordCount_sum: 4900 }] }} /></MemoryRouter>);
  expect(screen.getByTestId('report-number')).toHaveTextContent('4,900');
});

test('exposes explicit edit and remove actions only in dashboard edit mode', () => {
  const onRemove = vi.fn();
  const item = { id: 'I-4', reportId: 'R-4', title: 'Category share', status: 'ready', data: [] };
  const { rerender } = render(<MemoryRouter initialEntries={['/?persona=STATE_LEADERSHIP']}><CommandCenterReportSurface item={item} onRemove={onRemove} /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Edit Category share report' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove Category share report' })).not.toBeInTheDocument();

  rerender(<MemoryRouter initialEntries={['/?persona=STATE_LEADERSHIP']}><CommandCenterReportSurface item={item} editing onRemove={onRemove} returnTo="state-leadership" /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Edit Category share report' })).toHaveAttribute('href', '/reports/R-4?persona=STATE_LEADERSHIP&returnTo=state-leadership');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Category share report' }));
  expect(onRemove).toHaveBeenCalledWith('I-4');
});
