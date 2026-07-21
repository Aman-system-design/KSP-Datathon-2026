import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tiles" />,
  CircleMarker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));

import { HotspotMap } from './HotspotMap.jsx';

test('interactive map uses only real hotspot coordinates and provides a table alternative', () => {
  render(<HotspotMap hotspots={[
    { id: 'H-1', area: 'Central corridor', latitude: 12.9718, longitude: 77.5949, caseCount: 6, severity: 0.9 },
    { id: 'H-NO-COORDS', area: 'Unknown', caseCount: 2, severity: 0.4 },
  ]} />);

  expect(screen.getByTestId('map')).toBeInTheDocument();
  expect(screen.getAllByTestId('marker')).toHaveLength(1);
  expect(screen.getAllByText('Central corridor').length).toBeGreaterThan(0);
  expect(screen.getByRole('cell', { name: '12.9718, 77.5949' })).toBeInTheDocument();
  expect(screen.queryByText('H-NO-COORDS')).not.toBeInTheDocument();
});
