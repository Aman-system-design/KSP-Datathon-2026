import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { HomePage } from './HomePage.jsx';

vi.mock('../intelligence/IntelligenceWorkspacePage.jsx', () => ({
  IntelligenceWorkspacePage: ({ role }) => <div data-testid="intelligence-home">{role} Intelligence layout</div>,
}));

vi.mock('../intelligence/StateLeadershipDashboard.jsx', () => ({
  StateLeadershipDashboard: () => <div data-testid="legacy-state-dashboard">Legacy dashboard layout</div>,
}));

afterEach(cleanup);

test('State Leadership Home uses the Intelligence layout instead of the legacy dashboard canvas', () => {
  render(<HomePage api={{}} workspace={{ role: 'STATE_LEADERSHIP' }} />);

  expect(screen.getByTestId('intelligence-home')).toHaveTextContent('STATE_LEADERSHIP Intelligence layout');
  expect(screen.queryByTestId('legacy-state-dashboard')).not.toBeInTheDocument();
});
