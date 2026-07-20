const weights = { frequency: 0.25, severity: 0.20, recency: 0.15, trend: 0.15, anomaly: 0.15, hotspot: 0.10 };

export function calculateAreaRisk(input) {
  if (input.completeness < 0.7) {
    return Object.freeze({ status: 'WITHHELD', reason: 'INSUFFICIENT_COMPLETENESS', scope: 'AREA_TIME_ONLY', synthetic: true });
  }
  const components = Object.fromEntries(Object.entries(weights).map(([name, weight]) => {
    const value = Math.max(0, Math.min(100, Number(input[name])));
    return [name, { value, weight, contribution: Math.round(value * weight * 100) / 100 }];
  }));
  const score = Math.round(Object.values(components).reduce((sum, item) => sum + item.contribution, 0));
  return Object.freeze({
    status: 'CALCULATED',
    score,
    components,
    scope: 'AREA_TIME_ONLY',
    horizonDays: 7,
    version: '1.0.0',
    limitations: ['SYNTHETIC_DATA', 'ATTENTION_SIGNAL_NOT_CRIME_PREDICTION'],
    synthetic: true,
  });
}
