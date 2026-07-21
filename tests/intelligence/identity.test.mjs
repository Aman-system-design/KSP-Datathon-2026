import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIdentities, resolveIdentityPair } from '@ksp/intelligence-core/identity';

test('authoritative person id confirms a repeat identity', () => {
  const result = resolveIdentityPair(
    { appearanceId: 'A1', personId: 'P7', name: 'Synthetic A', age: 30, gender: 'M' },
    { appearanceId: 'A2', personId: 'P7', name: 'Synthetic A', age: 31, gender: 'M' });
  assert.equal(result.status, 'CONFIRMED');
  assert.equal(result.method, 'AUTHORITATIVE_PERSON_ID');
});

test('same name with conflicting person ids is never confirmed', () => {
  const result = resolveIdentityPair(
    { appearanceId: 'A1', personId: 'P31', name: 'Synthetic Same', age: 30, gender: 'M' },
    { appearanceId: 'A2', personId: 'P44', name: 'Synthetic Same', age: 30, gender: 'M' });
  assert.notEqual(result.status, 'CONFIRMED');
});

test('resolves all case appearances without automatic false confirmation', () => {
  const features = [
    { caseId: 'C1', accused: [{ appearanceId: 'APP-007-A', personId: 'P7', name: 'Synthetic A', age: 30, gender: 'M' }] },
    { caseId: 'C2', accused: [{ appearanceId: 'APP-007-B', personId: 'P7', name: 'Synthetic A', age: 31, gender: 'M' }] },
  ];
  const result = resolveIdentities(features);
  assert.equal(result.resolutions.filter(row => row.status === 'CONFIRMED').length, 1);
  assert.equal(result.diagnostics.candidatePairCount, 1);
});

test('identity search remains bounded for unrelated appearances', () => {
  const features = Array.from({ length: 100 }, (_, index) => ({
    caseId: `C-${index}`,
    accused: [{ appearanceId: `A-${index}`, personId: `P-${index}`, name: `Synthetic ${index}`, age: 30, gender: 'M' }],
  }));
  const result = resolveIdentities(features);
  assert.equal(result.resolutions.length, 0);
  assert.equal(result.diagnostics.candidatePairCount, 0);
  assert.equal(result.diagnostics.fullPairCount, 4950);
});
