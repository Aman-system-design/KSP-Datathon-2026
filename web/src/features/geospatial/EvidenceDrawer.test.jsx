import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { EvidenceDrawer } from './EvidenceDrawer.jsx';

test('evidence exposes only feature properties explicitly authorized for display', () => {
  render(<EvidenceDrawer
    selection={{
      id: 'FEATURE-1',
      properties: {
        displayEvidence: 'Authorized detail', labelOnly: 'Map label',
        weightOnly: 27, colorOnly: 0.93, magnitude: 99,
      },
    }}
    layer={{
      id: 'mixed-1', datasetId: 'mixed', name: 'Mixed intelligence', state: 'READY',
      dataset: {
        name: 'Mixed intelligence',
        fields: {
          displayEvidence: { type: 'string', uses: ['display'] },
          labelOnly: { type: 'string', uses: ['label'] },
          weightOnly: { type: 'number', uses: ['weight'] },
          colorOnly: { type: 'number', uses: ['color'] },
          magnitude: { type: 'number', uses: ['weight'] },
        },
      },
      meta: {},
    }}
    onClose={vi.fn()} onAcceptUpdate={vi.fn()}
  />);

  const evidence = screen.getByRole('dialog', { name: 'Evidence for FEATURE-1' });
  const authorizedFields = within(evidence).getByRole('heading', { name: 'Authorized feature fields' }).closest('section');
  expect(within(authorizedFields).getByText('displayEvidence')).toBeInTheDocument();
  expect(within(authorizedFields).getByText('Authorized detail')).toBeInTheDocument();
  for (const hidden of ['labelOnly', 'weightOnly', 'colorOnly', 'magnitude', 'Map label', '27', '0.93', '99']) {
    expect(within(evidence).queryByText(hidden)).not.toBeInTheDocument();
  }
});
