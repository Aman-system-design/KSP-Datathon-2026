import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceGraph, connectedCaseComponents } from '../../src/intelligence/network.mjs';

test('builds evidence-labelled case-person and co-accused graph', () => {
  const graph = buildEvidenceGraph([
    { caseId: 'C1', accused: [{ appearanceId: 'A1', personId: 'P1' }, { appearanceId: 'A2', personId: 'P2' }] },
    { caseId: 'C2', accused: [{ appearanceId: 'A3', personId: 'P1' }] },
  ]);
  assert.ok(graph.edges.every(edge => edge.evidenceType));
  assert.ok(graph.edges.some(edge => edge.type === 'PERSON_CO_ACCUSED'));
  assert.deepEqual(connectedCaseComponents(graph), [['C1', 'C2']]);
});
