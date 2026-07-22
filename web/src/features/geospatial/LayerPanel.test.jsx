import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { LayerPanel } from './LayerPanel.jsx';

test('saved-view failure is recoverable without hiding the usable dataset catalog', () => {
  const retryViews = vi.fn();
  render(<LayerPanel
    datasets={[{ id: 'hotspots', name: 'Crime hotspots', description: 'Authorized data' }]}
    savedViews={[]} layers={[]} catalogStatus="READY" catalogError={null}
    viewsStatus="FAILED" viewsError="saved views unavailable" onRetryViews={retryViews}
    onAddDataset={vi.fn()} onOpenView={vi.fn()} onToggle={vi.fn()} onMove={vi.fn()}
    onConfigure={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()}
  />);
  expect(screen.getByRole('button', { name: 'Add Crime hotspots' })).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent('saved views unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry saved views' }));
  expect(retryViews).toHaveBeenCalledOnce();
});
