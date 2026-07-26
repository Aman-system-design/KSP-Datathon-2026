export function measureKey(measure) {
  return measure ? `${measure.field}_${measure.aggregate}` : null;
}

export function cleanReportLabel(value, demonstration = false) {
  if (typeof value !== 'string') return value;
  return demonstration ? value.replace(/^Synthetic\s+/iu, '').trim() : value;
}

function numericValue(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function adaptReportRows(rows = [], definition = {}, { demonstration = false } = {}) {
  const dimension = definition.dimensions?.[0];
  const valueKey = measureKey(definition.measures?.[0]);
  return rows.map((row, index) => ({
    label: dimension ? (dimension === 'unitId' ? `Unit ${cleanReportLabel(row[dimension] ?? 'Unspecified', demonstration)}` : String(cleanReportLabel(row[dimension] ?? 'Unspecified', demonstration))) : `Row ${index + 1}`,
    value: valueKey ? numericValue(row[valueKey]) : null,
    row,
  }));
}

export const reportPoints = adaptReportRows;
