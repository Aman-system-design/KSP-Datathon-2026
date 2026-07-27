export const REPORT_VISUALIZATIONS = Object.freeze([
  { type: 'table', label: 'Table' },
  { type: 'number', label: 'KPI Number' },
  { type: 'bar', label: 'Bar' },
  { type: 'line', label: 'Line' },
  { type: 'pie', label: 'Pie' },
  { type: 'funnel', label: 'Funnel' },
  { type: 'map', label: 'Karnataka Map' },
].map(item => Object.freeze(item)));

const hasMeasure = source => Object.values(source?.fields ?? {})
  .some(field => field.type === 'number' && field.aggregates?.length > 0);
const hasDimension = source => Object.values(source?.fields ?? {}).some(field => field.dimension);
const hasGeography = source => ['areaId', 'unitId', 'latitude', 'longitude']
  .some(field => Object.hasOwn(source?.fields ?? {}, field));
const labelFor = type => REPORT_VISUALIZATIONS.find(item => item.type === type)?.label ?? type;

export function chartCompatibility({ source, type }) {
  if (!source?.visualizations?.includes(type)) return {
    compatible: false,
    reason: `This governed source does not support ${labelFor(type)} reports.`,
  };
  if (type === 'number' && !hasMeasure(source)) return {
    compatible: false,
    reason: 'KPI Number requires a numeric measure.',
  };
  if (['bar', 'line', 'pie', 'funnel'].includes(type) && (!hasDimension(source) || !hasMeasure(source))) return {
    compatible: false,
    reason: `${labelFor(type)} requires a grouping field and numeric measure.`,
  };
  if (type === 'map' && !hasGeography(source)) return {
    compatible: false,
    reason: 'Karnataka Map requires an approved geographic source.',
  };
  return { compatible: true, reason: '' };
}
