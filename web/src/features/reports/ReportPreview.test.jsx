import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { ReportPreview } from './ReportPreview.jsx';

afterEach(cleanup);

const rows = [{ district: 'Bengaluru', count_sum: 12 }, { district: 'Mysuru', count_sum: 7 }];

test.each([
  ['number', 'report-number'], ['table', 'report-table'], ['bar', 'report-bar'], ['line', 'report-line'],
  ['pie', 'report-pie'],
])('renders a functional %s preview from governed rows', (visualization, testId) => {
  render(<ReportPreview preview={rows} visualization={visualization} />);
  expect(screen.getByTestId(testId)).toBeInTheDocument();
  if (visualization === 'number') expect(screen.getByText('Count')).toBeInTheDocument();
  else expect(screen.getByText('Bengaluru')).toBeInTheDocument();
});

test.each(['area', 'heatmap', 'pivot', 'network'])('renders a migration message for unsupported legacy %s reports', visualization => {
  render(<ReportPreview preview={rows} visualization={visualization} />);
  expect(screen.getByRole('alert')).toHaveTextContent(`Legacy ${visualization} reports are unsupported`);
});

test('distinguishes an executed zero-row result from an unrun report', () => {
  const { rerender } = render(<ReportPreview preview={[]} definition={{ name: 'Empty', visualization: { type: 'table' }, style: {} }} hasRun={false} />);
  expect(screen.getByText('Preview your governed report')).toBeInTheDocument();
  rerender(<ReportPreview preview={[]} definition={{ name: 'Empty', visualization: { type: 'table' }, style: {} }} hasRun />);
  expect(screen.getByText('No matching records')).toBeInTheDocument();
  expect(screen.getByText(/change the source, filters, or grouping/i)).toBeInTheDocument();
});

test('keeps table rows static when no selection callback is supplied', () => {
  render(<ReportPreview preview={[{ caseId: 'CASE-1', caseNumber: '42/2026' }]} definition={{ name: 'Case register', dimensions: ['caseId', 'caseNumber'], visualization: { type: 'table' }, style: {} }} />);
  expect(screen.getByRole('table')).toHaveTextContent('42/2026');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('emits an accessible case identity selection from an interactive table row', () => {
  const onSelect = vi.fn();
  const row = { caseId: 'CASE-1', caseNumber: '42/2026', status: 'Under Investigation' };
  render(<ReportPreview preview={[row]} definition={{ name: 'Case register', dimensions: ['caseId', 'caseNumber', 'status'], visualization: { type: 'table' }, style: {} }} onSelect={onSelect} />);
  const control = screen.getByRole('button', { name: 'Open case 42/2026' });
  expect(control).toHaveAttribute('type', 'button');
  expect(control).toHaveTextContent('Open case 42/2026');
  fireEvent.click(control);
  expect(onSelect).toHaveBeenCalledWith({ field: 'caseId', value: 'CASE-1', row });
});

test('uses matching visible and accessible labels for generic table selections', () => {
  const onSelect = vi.fn();
  const row = { district: 'Mysuru', count_sum: 3 };
  render(<ReportPreview preview={[row]} definition={{ name: 'Districts', dimensions: ['district'], visualization: { type: 'table' }, style: {} }} onSelect={onSelect} />);
  const control = screen.getByRole('button', { name: 'Select Mysuru' });
  expect(control).toHaveTextContent('Select Mysuru');
  fireEvent.click(control);
  expect(onSelect).toHaveBeenCalledWith({ field: 'district', value: 'Mysuru', row });
});

test.each([
  ['SYNTHETIC', 'Demonstration data'],
  ['OPERATIONAL', 'Operational data'],
  ['MIXED', 'Mixed provenance'],
  ['EMPTY', 'No source rows'],
])('renders stable %s provenance without mislabelling mixed or empty results', (provenance, label) => {
  render(<ReportPreview preview={[{ district: 'Mysuru', count_sum: 3 }]} definition={{ name: 'Districts', dimensions: ['district'], measures: [{ field: 'count', aggregate: 'sum' }], visualization: { type: 'bar' }, style: {} }} provenance={provenance} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  if (provenance !== 'SYNTHETIC') expect(screen.queryByText('Demonstration data')).not.toBeInTheDocument();
});
