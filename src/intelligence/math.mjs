export const clamp01 = value => Math.max(0, Math.min(1, value));

export const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

export function median(values) {
  if (!values.length) throw new Error('median requires values');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const mad = values => {
  const center = median(values);
  return median(values.map(value => Math.abs(value - center)));
};

export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
