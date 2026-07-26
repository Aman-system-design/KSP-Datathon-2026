import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { ReportPreview } from '../ReportPreview.jsx';

afterEach(cleanup);

const preview = [{ district: 'Bengaluru', cases_sum: 12 }, { district: 'Mysuru', cases_sum: 7 }];
const definition = {
  dimensions: ['district'], measures: [{ field: 'cases', aggregate: 'sum' }],
  visualization: { type: 'bar', variant: 'vertical' }, style: { palette: 'risk', legend: 'right' },
};

test.each([
  ['bar', 'report-bar-chart'], ['pie', 'report-pie-chart'], ['line', 'report-line-chart'],
  ['funnel', 'report-funnel-chart'],
  ['table', 'report-table'],
])('renders distinct accessible output for %s', (type, testId) => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type } }} />);
  expect(screen.getByTestId(testId)).toBeInTheDocument();
  expect(screen.getByLabelText(`${type} report visualization`)).toBeInTheDocument();
});

test('applies theme and report palette tokens at the preview boundary', () => {
  render(<ReportPreview appearance="dark" preview={preview} definition={definition} />);
  const canvas = screen.getByLabelText('Report preview');
  expect(canvas).toHaveAttribute('data-appearance', 'dark');
  expect(canvas.style.getPropertyValue('--report-accent')).not.toBe('');
  expect(canvas.style.getPropertyValue('--report-surface')).toBe('#111827');
  expect(screen.getByTestId('report-bar-chart')).toHaveStyle({ color: 'var(--report-text)' });
});

test('changing palette changes the rendered preview theme', () => {
  const { rerender } = render(<ReportPreview preview={preview} definition={{ ...definition, style: { palette: 'ksp' } }} />);
  const canvas = screen.getByLabelText('Report preview');
  expect(canvas.style.getPropertyValue('--report-accent')).toBe('#174f78');
  rerender(<ReportPreview preview={preview} definition={{ ...definition, style: { palette: 'risk' } }} />);
  expect(canvas.style.getPropertyValue('--report-accent')).toBe('#0f766e');
});

test('shows a truthful unavailable reason when chart output lacks its governed measure', () => {
  render(<ReportPreview hasRun preview={[{ district: 'Bengaluru' }]} definition={definition} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Visualization unavailable');
  expect(screen.getByRole('alert')).toHaveTextContent('cases_sum');
  expect(screen.queryByTestId('report-bar-chart')).not.toBeInTheDocument();
});

test('shows a truthful unavailable reason when map output lacks district codes', () => {
  render(<ReportPreview hasRun preview={[{ RecordCount_sum: 12 }]} definition={{ ...definition, dimensions: ['DistrictCode'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], visualization: { type: 'map' } }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Visualization unavailable');
  expect(screen.getByRole('alert')).toHaveTextContent('DistrictCode');
});

test('renders risk and workload only as normalized variants', () => {
  const { rerender } = render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'number', variant: 'risk' } }} />);
  expect(screen.getByTestId('report-risk-chart')).toBeInTheDocument();
  rerender(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'bar', variant: 'workload' } }} />);
  expect(screen.getByTestId('report-workload-chart')).toBeInTheDocument();
});

test('style title legend and value labels control visible renderer output', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'pie', variant: 'doughnut' }, style: { titleVisible: false, legend: 'none', valueLabels: false } }} />);
  expect(screen.queryByRole('heading', { name: definition.name })).not.toBeInTheDocument();
  expect(screen.queryByTestId('report-legend')).not.toBeInTheDocument();
  expect(screen.queryByText('12')).not.toBeInTheDocument();
});

test('subtitle visibility and compact table density affect rendered output', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'table' }, style: { subtitleVisible: false, tableDensity: 'compact' } }} />);
  expect(screen.queryByText(/Executed within/)).not.toBeInTheDocument();
  expect(screen.getByTestId('report-table')).toHaveClass('report-table-wrap--compact');
});

test('value labels default to hidden when omitted', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, style: {}, visualization: { type: 'bar' } }} />);
  expect(screen.queryByText('12')).not.toBeInTheDocument();
});

test.each(['area', 'heatmap', 'pivot', 'network'])('renders explicit unsupported state for legacy %s definitions', type => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type } }} />);
  expect(screen.getByRole('alert')).toHaveTextContent(`Legacy ${type} reports are unsupported`);
});

test('supports horizontal bars and doughnut and area variants', () => {
  const { rerender } = render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'bar', variant: 'horizontal' } }} />);
  expect(screen.getByTestId('report-bar-chart')).toHaveAttribute('data-orientation', 'horizontal');
  rerender(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'pie', variant: 'doughnut' } }} />);
  expect(screen.getByTestId('report-pie-chart')).toHaveAttribute('data-variant', 'doughnut');
  rerender(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'line', variant: 'area' } }} />);
  expect(screen.getByTestId('report-line-chart')).toHaveAttribute('data-variant', 'area');
});

test('bar charts expose a professional plot grid and formatted scale', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, style: { valueLabels: true }, visualization: { type: 'bar' } }} />);
  expect(screen.getByTestId('report-chart-grid')).toBeInTheDocument();
  expect(screen.getByLabelText('Chart scale')).toHaveTextContent('12');
});

test('doughnut reports expose the governed total in the chart centre', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, style: { valueLabels: true }, visualization: { type: 'pie', variant: 'doughnut' } }} />);
  expect(screen.getByLabelText('Total 19')).toBeInTheDocument();
});

test('line reports identify the peak evidence point', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'line', variant: 'area' } }} />);
  expect(screen.getByTestId('report-line-peak')).toHaveAccessibleName(/Bengaluru/);
  expect(screen.getByTestId('report-chart-grid')).toBeInTheDocument();
});

test('risk report has a summary score and contributing evidence bars', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'number', variant: 'risk' } }} />);
  expect(screen.getByLabelText('Risk score 12')).toBeInTheDocument();
  expect(screen.getByTestId('report-risk-factors')).toBeInTheDocument();
});

test('pie legend supports hover, keyboard selection, and selected evidence detail', () => {
  const onSelect = vi.fn();
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'pie', variant: 'doughnut' }, style: { palette: 'ksp', legend: 'right', valueLabels: true } }} onSelect={onSelect} />);
  const bengaluru = within(screen.getByTestId('report-legend')).getByRole('button', { name: /Bengaluru/ });
  fireEvent.mouseEnter(bengaluru);
  expect(screen.getByRole('status')).toHaveTextContent('Bengaluru');
  fireEvent.click(bengaluru);
  expect(bengaluru).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('region', { name: 'Selected category' })).toHaveTextContent('12');
  expect(onSelect).toHaveBeenCalledWith(preview[0]);
});

test('native pie legend activation selects once while SVG slices retain keyboard activation', () => {
  const onSelect = vi.fn();
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'pie' }, style: { legend: 'right' } }} onSelect={onSelect} />);
  const legendButton = within(screen.getByTestId('report-legend')).getByRole('button', { name: /Bengaluru/ });
  fireEvent.keyDown(legendButton, { key: 'Enter' });
  fireEvent.click(legendButton);
  expect(onSelect).toHaveBeenCalledTimes(1);
  const slice = within(screen.getByRole('img', { name: 'Category share' })).getByRole('button', { name: 'Bengaluru: 12' });
  fireEvent.keyDown(slice, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledTimes(2);
});

test('removes the visible Synthetic prefix while preserving demonstration provenance', () => {
  const synthetic = [{ category: 'Synthetic Theft', cases_sum: 12, IsSynthetic: true }];
  render(<ReportPreview preview={synthetic} definition={{ ...definition, dimensions: ['category'] }} />);
  expect(screen.queryByText('Synthetic Theft')).not.toBeInTheDocument();
  expect(screen.getByText('Theft')).toBeInTheDocument();
  expect(screen.getByText('Demonstration data')).toBeInTheDocument();
});

test('preserves legitimate production labels that begin with Synthetic', () => {
  render(<ReportPreview preview={[{ category: 'Synthetic Biology Fraud', cases_sum: 2 }]} definition={{ ...definition, dimensions: ['category'] }} />);
  expect(screen.getByText('Synthetic Biology Fraud')).toBeInTheDocument();
  expect(screen.queryByText('Demonstration data')).not.toBeInTheDocument();
});

test.each([
  ['blank dimension', [{ district: '   ', cases_sum: 2 }], { ...definition, dimensions: ['district'] }, /does not contain district/],
  ['blank measure', [{ district: 'Mysuru', cases_sum: '   ' }], definition, /does not contain numeric cases_sum/],
])('fails closed for %s values', (_label, rows, reportDefinition, reason) => {
  render(<ReportPreview preview={rows} definition={reportDefinition} />);
  expect(screen.getByRole('alert')).toHaveTextContent(reason);
});

test('number reports use the authored value label and never Row 1', () => {
  render(<ReportPreview preview={[{ cases_sum: 19 }]} definition={{ ...definition, description: 'Total FIRs', dimensions: [], visualization: { type: 'number' } }} />);
  expect(screen.getByText('Total FIRs')).toBeInTheDocument();
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
});

test('line reports honor the semantic palette and smooth interpolation', () => {
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'line', variant: 'smooth' }, style: { palette: 'ksp', valueLabels: true } }} />);
  expect(screen.getByTestId('report-line-chart')).toHaveAttribute('data-interpolation', 'smooth');
  expect(screen.getByTestId('report-line-path')).toHaveStyle({ stroke: '#174f78' });
  expect(screen.getByRole('button', { name: 'Bengaluru: 12' })).toHaveAttribute('tabindex', '0');
});

test('line points expose button semantics and keyboard selection', () => {
  const onSelect = vi.fn();
  render(<ReportPreview preview={preview} definition={{ ...definition, visualization: { type: 'line' } }} onSelect={onSelect} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Bengaluru: 12' }), { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith(preview[0]);
});
