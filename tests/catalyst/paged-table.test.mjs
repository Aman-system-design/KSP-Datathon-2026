import assert from 'node:assert/strict';
import test from 'node:test';

import { readPagedRows } from '../../src/backend/repository/catalyst/paged-table.mjs';

test('reads three bounded Catalyst pages with opaque token forwarding', async () => {
  const calls = [];
  const pages = [
    { data: [{ ROWID: '1', Value: 'A' }], more_records: true, next_token: 'opaque-2' },
    { data: [{ ROWID: '2', Value: 'B' }], more_records: true, next_token: 'opaque-3' },
    { data: [{ ROWID: '3', Value: 'C' }], more_records: false },
  ];
  const table = {
    async getPagedRows(options) {
      calls.push(options);
      return pages[calls.length - 1];
    },
    getAllRows() { throw new Error('deprecated getAllRows must never be called'); },
  };

  const result = await readPagedRows({ table, maxRows: 125, maxPages: 3 });
  assert.deepEqual(calls, [
    { maxRows: 125 },
    { maxRows: 125, nextToken: 'opaque-2' },
    { maxRows: 125, nextToken: 'opaque-3' },
  ]);
  assert.deepEqual(result, {
    rows: pages.flatMap(page => page.data), nextToken: null, pageCount: 3,
  });
});

test('supports an incoming token and returns a continuation at the page bound', async () => {
  const calls = [];
  const table = { getPagedRows: async (options) => {
    calls.push(options);
    return { data: [{ Value: calls.length }], next_token: `next-${calls.length}` };
  } };
  const result = await readPagedRows({ table, maxRows: 200, maxPages: 2, nextToken: 'incoming' });
  assert.deepEqual(calls, [
    { maxRows: 200, nextToken: 'incoming' },
    { maxRows: 200, nextToken: 'next-1' },
  ]);
  assert.deepEqual(result, { rows: [{ Value: 1 }, { Value: 2 }], nextToken: 'next-2', pageCount: 2 });
});

test('rejects invalid bounds, malformed pages and token loops', async () => {
  const validTable = { getPagedRows: async () => ({ data: [] }) };
  for (const maxRows of [0, 201, 1.5, '200']) {
    await assert.rejects(() => readPagedRows({ table: validTable, maxRows }), /maxRows/i);
  }
  for (const maxPages of [0, 101, 1.5, '3']) {
    await assert.rejects(() => readPagedRows({ table: validTable, maxPages }), /maxPages/i);
  }
  await assert.rejects(() => readPagedRows({ table: { getPagedRows: async () => ({ data: {} }) } }), /page|rows/i);
  await assert.rejects(() => readPagedRows({ table: { getPagedRows: async () => ({ data: [], next_token: 42 }) } }), /token/i);
  await assert.rejects(() => readPagedRows({ table: { getPagedRows: async () => ({ data: [], more_records: true }) } }), /token/i);

  const looping = { getPagedRows: async () => ({ data: [], next_token: 'same' }) };
  await assert.rejects(() => readPagedRows({ table: looping, nextToken: 'same' }), /token|loop/i);
});
