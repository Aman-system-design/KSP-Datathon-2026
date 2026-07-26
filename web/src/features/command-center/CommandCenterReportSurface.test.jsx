import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterReportSurface } from './CommandCenterReportSurface.jsx';

afterEach(cleanup);

test('renders a governed table through the report preview', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-1', reportId: 'R-1', title: 'District movement', status: 'ready', definition: { name: 'District movement', dimensions: ['district'], measures: [{ field: 'case', aggregate: 'count' }], visualization: { type: 'table' }, style: {} }, data: [{ district: 'Mysuru', case_count: 12 }] }} /></MemoryRouter>);
  expect(screen.getAllByRole('heading', { name: 'District movement' })).toHaveLength(2);
  expect(screen.getByLabelText('table report visualization')).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Mysuru');
  expect(screen.getByRole('table')).toHaveTextContent('12');
});

test('renders charts as visualizations and forwards the selected governed row', () => {
  const onSelect = vi.fn();
  const item = { id: 'I-1', reportId: 'R-1', title: 'Case ageing', status: 'ready', definition: { name: 'Case ageing', dimensions: ['ageingBucket'], measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'bar' }, style: {} }, data: [{ ageingBucket: '60+ days', recordCount_sum: 4 }] };
  render(<MemoryRouter><CommandCenterReportSurface item={item} onSelect={onSelect} /></MemoryRouter>);
  expect(screen.getByLabelText('bar report visualization')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByTitle('60+ days: 4'));
  expect(onSelect).toHaveBeenCalledWith(item, {
    field: 'ageingBucket', value: '60+ days',
    row: { ageingBucket: '60+ days', recordCount_sum: 4 },
  });
});

test('normalizes category chart selections from the report first dimension', () => {
  const onSelect = vi.fn();
  const row = { majorHead: 'Property', recordCount_sum: 7 };
  const item = { id: 'I-7', reportId: 'R-7', title: 'Crime Category', status: 'ready', definition: { name: 'Crime Category', dimensions: ['majorHead'], measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'pie' }, style: {} }, data: [row] };
  render(<MemoryRouter><CommandCenterReportSurface item={item} onSelect={onSelect} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Property: 7' }));
  expect(onSelect).toHaveBeenCalledWith(item, { field: 'majorHead', value: 'Property', row });
});

test('forwards a meaningful Open Case Register row selection', () => {
  const onSelect = vi.fn();
  const row = { caseId: 'CASE-17', caseNumber: '17/2026', status: 'Under Investigation' };
  const item = { id: 'I-9', reportId: 'R-9', title: 'Open Case Register', status: 'ready', definition: { name: 'Open Case Register', dimensions: ['caseId', 'caseNumber', 'status'], measures: [], visualization: { type: 'table' }, style: {} }, data: [row] };
  render(<MemoryRouter><CommandCenterReportSurface item={item} onSelect={onSelect} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open case 17/2026' }));
  expect(onSelect).toHaveBeenCalledWith(item, { field: 'caseId', value: 'CASE-17', row });
});

test('contains a failed report with a safe reference', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-2', reportId: 'R-2', title: 'Report unavailable', status: 'error', errorCode: 'REPORT_FAILED' }} /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Reference REPORT_FAILED');
});

test('retains the isolated governed map surface', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-3', reportId: 'R-3', title: 'Map', status: 'ready', mapExecution: { mapView: {} } }} /></MemoryRouter>);
  expect(screen.getByText('Governed map output')).toBeInTheDocument();
  expect(screen.queryByLabelText('Report preview')).not.toBeInTheDocument();
});
