import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { ReportBuilder } from './ReportBuilder.jsx';

test('analyst configures, previews and saves a governed anomaly report', async () => {
  const api = {
    get: vi.fn(async () => ({ data: [{ key: 'anomalies', label: 'Trend anomalies', fields: {
      unitId: { type: 'string', dimension: true }, observed: { type: 'number', aggregates: ['sum'] },
    }, visualizations: ['table', 'bar', 'line'] }] })),
    post: vi.fn(async (path) => path.endsWith('/execute')
      ? { data: { result: { data: { items: [{ unitId: 101, observed: 7 }] } } } }
      : { data: { id: 'R-1', name: 'Anomaly watch', version: 1 } }),
  };
  render(<ReportBuilder api={api} />);
  expect(await screen.findByRole('option', { name: 'Trend anomalies' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Anomaly watch' } });
  fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'unitId' } });
  fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'observed:sum' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }));
  expect(await screen.findByText('Unit 101')).toBeInTheDocument();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
});
