import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';

import { PersonaDirectory } from './PersonaDirectory.jsx';

afterEach(cleanup);

test('demo presenter can open every allowlisted persona workspace for the jury walkthrough', () => {
  render(<MemoryRouter><PersonaDirectory role="DEMO_PRESENTER" /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Persona Workspaces' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Open workspace' })).toHaveLength(4);
  expect(screen.getByText('State Leadership')).toBeInTheDocument();
  expect(screen.getByText('Crime Analyst')).toBeInTheDocument();
  expect(screen.getByText('Station Operations')).toBeInTheDocument();
});

test('platform administrator sees the monitored workspace catalogue without impersonation links', () => {
  render(<MemoryRouter><PersonaDirectory role="PLATFORM_ADMIN" /></MemoryRouter>);
  expect(screen.getByText(/KSP Intelligence account is required/i)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open workspace' })).not.toBeInTheDocument();
});

test('an ordinary operational role cannot view the directory', () => {
  render(<MemoryRouter><PersonaDirectory role="CRIME_ANALYST" /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Workspace not authorized' })).toBeInTheDocument();
  expect(screen.queryByText('State Leadership')).not.toBeInTheDocument();
});
