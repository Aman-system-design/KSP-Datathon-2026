import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';

import { CommandCenterReportSurface } from './CommandCenterReportSurface.jsx';

test('renders returned governed rows without inventing a metric', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-1', reportId: 'R-1', title: 'District movement', status: 'ready', visualization: 'table', data: [{ district: 'Mysuru', case_count: 12 }] }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'District movement' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Mysuru');
  expect(screen.getByRole('table')).toHaveTextContent('12');
});

test('contains a failed report with a safe reference', () => {
  render(<MemoryRouter><CommandCenterReportSurface item={{ id: 'I-2', reportId: 'R-2', title: 'Report unavailable', status: 'error', errorCode: 'REPORT_FAILED' }} /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Reference REPORT_FAILED');
});
