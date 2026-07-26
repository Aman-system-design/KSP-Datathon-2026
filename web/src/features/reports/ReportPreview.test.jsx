import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

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
