import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { MapReport } from './MapReport.jsx';

afterEach(cleanup);

function SelectableMap({ layers, onFeatureSelect }) {
  return <><output aria-label="District labels">{layers[0].layer.labelValueField ?? 'hidden'}</output><button type="button" onClick={() => onFeatureSelect({ layerId: 'karnataka-districts', id: 'KA-524', properties: { districtName: 'Bagalkot', caseCount: 322 } })}>Select Bagalkot</button></>;
}

test('prominently identifies the selected district instead of a generic choropleth heading', () => {
  render(<MapReport density="dashboard" MapComponent={SelectableMap} rows={[{ DistrictCode: 'KA-524', RecordCount_sum: 322 }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Select Bagalkot' }));
  expect(screen.getByRole('status', { name: 'Selected district Bagalkot' })).toHaveTextContent('322 cases');
  expect(screen.queryByRole('region', { name: 'Map information' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Map information' })).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Case count legend' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show case count legend' }));
  expect(screen.getByRole('list', { name: 'Case count legend' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hide case count legend' })).toBeInTheDocument();
  expect(screen.getByLabelText('District labels')).toHaveTextContent('caseCount');
  expect(screen.queryByText('districtName')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hide case numbers' }));
  expect(screen.getByLabelText('District labels')).toHaveTextContent('hidden');
  fireEvent.click(screen.getByRole('button', { name: 'Show case numbers' }));
  expect(screen.getByLabelText('District labels')).toHaveTextContent('caseCount');
  expect(screen.queryByText('District choropleth')).not.toBeInTheDocument();
});
