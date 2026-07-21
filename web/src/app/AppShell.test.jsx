import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';

import { AppShell } from './AppShell.jsx';

test('role workspace exposes navigation, synthetic status, dashboard switcher and persistent alert centre', () => {
  render(<MemoryRouter><AppShell workspace={{
    role: 'CRIME_ANALYST', scopeUnitId: 101, syntheticData: true,
    availableDashboards: [{ id: 'D-1', name: 'Analyst desk' }], alertSummary: { total: 3 },
  }}><p>Workspace content</p></AppShell></MemoryRouter>);
  expect(screen.getByRole('banner')).toHaveTextContent('Karnataka Police Intelligence');
  expect(screen.getByText('Crime Analyst')).toBeInTheDocument();
  expect(screen.getByLabelText('Active dashboard')).toHaveValue('D-1');
  expect(screen.getByRole('link', { name: /alerts 3/i })).toBeInTheDocument();
  expect(screen.getByText(/synthetic demonstration data/i)).toBeInTheDocument();
  expect(screen.getByText('Workspace content')).toBeInTheDocument();
});
