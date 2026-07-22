import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { VisibleFeatureTable } from './VisibleFeatureTable.jsx';

test('table details and evidence selection use only pre-projected display properties', () => {
  const onSelect = vi.fn();
  render(<VisibleFeatureTable features={[{
    id: 'HOT-1', layerId: 'layer-1', layerName: 'Hotspots',
    properties: { displayEvidence: 'Visible', rendererWeight: 19, rendererColor: 0.8 },
    displayProperties: { displayEvidence: 'Visible' },
  }]} onSelect={onSelect} />);
  const table = screen.getByRole('table', { name: 'Visible authorized map features' });
  expect(within(table).getByText(/displayEvidence: Visible/)).toBeInTheDocument();
  expect(within(table).queryByText(/rendererWeight|rendererColor/)).not.toBeInTheDocument();
  fireEvent.click(within(table).getByRole('button', { name: 'Open evidence for HOT-1' }));
  expect(onSelect).toHaveBeenCalledWith({
    layerId: 'layer-1', id: 'HOT-1', properties: { displayEvidence: 'Visible' },
  });
});
