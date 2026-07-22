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

test('contributing actions accept only canonical same-origin paths', () => {
  render(<EvidenceDrawer
    selection={{ id: 'FEATURE-1', properties: {} }}
    layer={{
      id: 'layer-1', dataset: { name: 'Evidence', fields: {} }, state: 'READY',
      meta: { contributingRecords: [{
        id: 'CASE-1', authorized: true,
        actions: [
          { label: 'Open safe case', href: '/cases/CASE-1?tab=evidence' },
          { label: 'Backslash path', href: '/cases\\CASE-2' },
          { label: 'Control path', href: '/cases/CASE-3\nnext' },
          { label: 'Encoded backslash', href: '/cases%5CCASE-4' },
          { label: 'Encoded control', href: '/cases/CASE-5%0Anext' },
          { label: 'External path', href: 'https://evil.example/case' },
          { label: 'Protocol relative', href: '//evil.example/case' },
          { label: 'Script path', href: 'javascript:alert(1)' },
        ],
      }] },
    }}
    onClose={vi.fn()} onAcceptUpdate={vi.fn()}
  />);
  expect(screen.getByRole('link', { name: 'Open safe case' })).toHaveAttribute('href', '/cases/CASE-1?tab=evidence');
  expect(screen.getAllByRole('link')).toHaveLength(1);
});
