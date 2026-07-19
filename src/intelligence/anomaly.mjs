import { median, mad } from './math.mjs';

export function detectAnomaly({ seriesId, history, current, seasonalPeriod = 0, evidenceCaseIds = [] }) {
  if (history.length < 12) {
    return Object.freeze({ seriesId, isAnomaly: false, limitation: 'INSUFFICIENT_BASELINE', synthetic: true });
  }
  const comparable = seasonalPeriod > 0 && history.length >= seasonalPeriod * 2
    ? history.filter((_, index) => index % seasonalPeriod === history.length % seasonalPeriod)
    : history;
  const expected = median(comparable);
  const spread = Math.max(1, 1.4826 * mad(comparable));
  const deviation = (current - expected) / spread;
  const expectedUpper = expected + 3 * spread;
  const isAnomaly = current >= expected + 3 && deviation >= 3;
  return Object.freeze({
    id: `ANOM-${seriesId}`,
    seriesId,
    method: seasonalPeriod ? 'SEASONAL_MEDIAN_MAD' : 'MEDIAN_MAD',
    version: '1.0.0',
    observed: current,
    expected,
    expectedLower: Math.max(0, expected - 3 * spread),
    expectedUpper,
    deviation,
    isAnomaly,
    evidenceCaseIds: [...evidenceCaseIds].sort(),
    limitations: ['SYNTHETIC_DATA'],
    synthetic: true,
  });
}
