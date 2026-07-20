const CATALYST_METADATA = new Set([
  'ROWID', 'CREATORID', 'CREATEDTIME', 'MODIFIEDTIME', 'MODIFIEDBY',
]);

export function mapCatalystRow(row, { includeRowId = false } = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('Catalyst row must be an object.');
  const mapped = {};
  if (includeRowId && row.ROWID !== undefined && row.ROWID !== null) mapped.ROWID = String(row.ROWID);
  for (const [key, value] of Object.entries(row)) {
    if (CATALYST_METADATA.has(key) || key.startsWith('ZC_')) continue;
    mapped[key] = structuredClone(value);
  }
  return mapped;
}
