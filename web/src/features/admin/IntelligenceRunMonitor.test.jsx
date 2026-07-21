import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { IntelligenceRunMonitor } from './IntelligenceRunMonitor.jsx';

afterEach(cleanup);

describe('IntelligenceRunMonitor', () => {
  test('loads persisted run state and submits through an idempotent API command', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ data: [{
        RunRequestID: 'RUNREQ-1', BatchKey: 'SOURCE-BATCH-1', Status: 'PUBLISHED',
        CatalystJobID: 'JOB-1', RequestedAt: '2026-07-22 08:00:00', CurrentRunGroupID: 'GROUP-1',
      }] }),
      workflow: vi.fn().mockResolvedValue({ data: {
        RunRequestID: 'RUNREQ-2', BatchKey: 'SOURCE-BATCH-2', Status: 'SUBMITTED', CatalystJobID: 'JOB-2',
      } }),
    };
    render(<IntelligenceRunMonitor api={api} />);

    expect((await screen.findAllByText('RUNREQ-1')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Validated source batch'), { target: { value: 'SOURCE-BATCH-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run intelligence refresh' }));

    await waitFor(() => expect(api.workflow).toHaveBeenCalledWith('/v1/intelligence-runs', { batchKey: 'SOURCE-BATCH-2' }));
    expect((await screen.findAllByText('RUNREQ-2')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('SUBMITTED').length).toBeGreaterThan(0);
  });

  test('shows stable backend failure state instead of simulated success', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: [{
      RunRequestID: 'RUNREQ-FAIL', BatchKey: 'SOURCE-BATCH-FAIL', Status: 'FAILED_RETRYABLE',
      FailedPhase: 'REFRESH_BATCH_LOOKUP', FailureCode: 'DATA_NOT_READY',
    }] }), workflow: vi.fn() };
    render(<IntelligenceRunMonitor api={api} />);
    expect((await screen.findAllByText('FAILED_RETRYABLE')).length).toBeGreaterThan(0);
    expect(screen.getByText('DATA_NOT_READY')).toBeInTheDocument();
  });
});
