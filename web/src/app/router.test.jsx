import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { AlertsPage, Failure } from './router.jsx';

afterEach(cleanup);

test('failure state never exposes an internal JavaScript error', () => {
  render(<Failure error={new TypeError("Cannot read properties of undefined (reading 'items')")} />);

  expect(screen.getByText('The request could not be completed.')).toBeInTheDocument();
  expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
});

test('alerts page treats a missing collection as an empty authorized result', async () => {
  const api = { get: vi.fn(async () => ({ data: {} })) };
  render(<MemoryRouter><AlertsPage api={api} /></MemoryRouter>);

  expect(await screen.findByText('No alerts are visible in the current authorized scope.')).toBeInTheDocument();
  expect(screen.queryByText('Intelligence is unavailable')).not.toBeInTheDocument();
});
