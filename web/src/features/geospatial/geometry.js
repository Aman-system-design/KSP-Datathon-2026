function positions(geometry) {
  if (geometry?.type === 'Polygon') return geometry.coordinates.flat(1);
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.flat(2);
  return [];
}

export function boundsForArea(geometry) {
  const points = positions(geometry).filter(position => (
    Array.isArray(position) && Number.isFinite(position[0]) && Number.isFinite(position[1])
  ));
  if (points.length === 0) return null;
  const longitude = points.map(point => point[0]);
  const latitude = points.map(point => point[1]);
  const bounds = [Math.min(...longitude), Math.min(...latitude), Math.max(...longitude), Math.max(...latitude)];
  return bounds[0] < bounds[2] && bounds[1] < bounds[3] ? bounds : null;
}
