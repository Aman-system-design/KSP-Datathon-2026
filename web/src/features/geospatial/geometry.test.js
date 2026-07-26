import { expect, test } from 'vitest';

import { boundsForArea } from './geometry.js';

test('derives map-fit bounds for administrative polygon drilldown', () => {
  expect(boundsForArea({
    type: 'Polygon',
    coordinates: [[[74, 11], [78, 11], [78, 15], [74, 15], [74, 11]]],
  })).toEqual([74, 11, 78, 15]);
});

test('rejects point and degenerate geometry as area drilldown targets', () => {
  expect(boundsForArea({ type: 'Point', coordinates: [77, 13] })).toBeNull();
  expect(boundsForArea({ type: 'Polygon', coordinates: [[[77, 13], [77, 13], [77, 13], [77, 13]]] })).toBeNull();
});
