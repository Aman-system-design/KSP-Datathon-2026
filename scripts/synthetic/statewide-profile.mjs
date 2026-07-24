export const STATEWIDE_CASE_COUNT = 5200;
export const STATEWIDE_SEED = 20260724;
export const STATEWIDE_OUTPUT_DIRECTORY = new URL('../../artifacts/source-seed-statewide/', import.meta.url);

export const statewideSourceOptions = Object.freeze({
  seed: STATEWIDE_SEED,
  caseCount: STATEWIDE_CASE_COUNT,
  profile: 'statewide',
});
