export const RESULT_PROVENANCE = Object.freeze({
  SYNTHETIC: 'SYNTHETIC',
  OPERATIONAL: 'OPERATIONAL',
  MIXED: 'MIXED',
  EMPTY: 'EMPTY',
});

export function deriveResultProvenance(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return RESULT_PROVENANCE.EMPTY;
  const syntheticCount = rows.filter(row => row?.syntheticData === true).length;
  if (syntheticCount === rows.length) return RESULT_PROVENANCE.SYNTHETIC;
  if (syntheticCount === 0) return RESULT_PROVENANCE.OPERATIONAL;
  return RESULT_PROVENANCE.MIXED;
}

export function provenanceFields(rows) {
  const provenance = deriveResultProvenance(rows);
  return Object.freeze({
    provenance,
    syntheticData: provenance === RESULT_PROVENANCE.SYNTHETIC,
  });
}
