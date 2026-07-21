import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { NetworkView } from './NetworkView.jsx';

test('network search loads an authorized evidence graph and labels links as signals', async () => {
  const api = { get: vi.fn(async () => ({ data: {
    node: { id: 'PERSON:PERSON-008', type: 'PERSON' }, repeatAppearanceCount: 2,
    edges: [{ from: 'PERSON:PERSON-008', to: 'CASE-001', type: 'APPEARS_IN', sourceCaseId: 'CASE-001' }],
    limitations: ['LINK_IS_INVESTIGATIVE_SIGNAL_NOT_PROOF'],
  } })) };
  render(<NetworkView api={api} />);
  fireEvent.change(screen.getByLabelText('Person or case identifier'), { target: { value: 'PERSON:PERSON-008' } });
  fireEvent.click(screen.getByRole('button', { name: 'Build network' }));

  expect(await screen.findByText('2 appearances')).toBeInTheDocument();
  expect(screen.getAllByText('CASE-001')).toHaveLength(2);
  expect(screen.getByText(/investigative signal not proof/i)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/networks/PERSON:PERSON-008');
});
