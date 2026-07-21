import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { AlertDetail } from './AlertDetail.jsx';

test('alert detail exposes explanation, limitations, evidence and versioned note action', async () => {
  const api = { post: vi.fn(async () => ({ data: {} })) };
  render(<AlertDetail api={api} alert={{
    id: 'ALT-1', title: 'Cross-district property pattern', status: 'GENERATED', version: 0,
    explanation: { method: 'EXPLAINABLE_MULTI_SIGNAL_FUSION', methodVersion: '1.0.0', confidence: 0.96, components: { spatial: 0.8, temporal: 1 } },
    limitations: ['SYNTHETIC_DATA', 'SIMILARITY_IS_NOT_PROOF'],
    evidence: [{ unitId: 101, caseId: 'CASE-001', stationId: 'PS-1001', briefFacts: 'Synthetic rear-window entry.' }],
  }} />);
  expect(screen.getByText('96%')).toBeInTheDocument();
  expect(screen.getByText('SIMILARITY IS NOT PROOF')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'CASE-001' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Add investigation note'), { target: { value: 'Verify station records.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
  expect(api.post).toHaveBeenCalledWith('/v1/alerts/ALT-1/notes', expect.objectContaining({ expectedVersion: 0 }));
});
