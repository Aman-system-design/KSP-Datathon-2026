import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { generateIntelligenceRunbook } from '../../scripts/schema/generate-intelligence-runbook.mjs';

const schema = JSON.parse(await readFile(
  new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url),
  'utf8',
));

test('runbook is deterministic and generated from all 19 manifest tables', () => {
  const first = generateIntelligenceRunbook(schema);
  const second = generateIntelligenceRunbook(structuredClone(schema));
  assert.equal(first, second);
  assert.equal((first.match(/^## Create table:/gm) ?? []).length, 19);
  assert.match(first, /Development only/i);
  assert.match(first, /post-creation verification checklist/i);

  for (const table of schema.tables) {
    assert.ok(first.includes(`## Create table: ${table.name}`));
    for (const column of table.columns) {
      assert.ok(first.includes(`\`${column.name}\``), `${table.name}.${column.name} missing`);
      if (column.type === 'foreign_key') {
        assert.ok(first.includes(`\`${column.parentTable}\``));
        assert.match(first, /On Delete = Null/i);
      }
    }
  }
});

test('runbook exposes Catalyst constraints and PII choices', () => {
  const output = generateIntelligenceRunbook(schema);
  for (const heading of ['Mandatory', 'Unique', 'Search index', 'PII/ePHI']) {
    assert.ok(output.includes(heading));
  }
  assert.match(output, /Never select Cascade/i);
  assert.match(output, /Catalyst IaC export/i);
});
