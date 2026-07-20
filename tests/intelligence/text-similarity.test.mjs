import test from 'node:test';
import assert from 'node:assert/strict';
import { textSimilarity } from '@ksp/intelligence-core/text-similarity';

test('similar modus-operandi text scores above unrelated text', () => {
  const left = 'Synthetic test record: rear-window entry, jewellery targeted, motorcycle observed.';
  const related = 'Synthetic test record: motorcycle seen after rear window entry and jewellery theft.';
  const unrelated = 'Synthetic test record: online payment credential complaint.';
  assert.ok(textSimilarity(left, related) > textSimilarity(left, unrelated));
});
