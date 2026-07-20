import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const sha256 = text => createHash('sha256').update(text).digest('hex');
const csvCell = (value) => {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function toCsv(rows) {
  const columns = Object.keys(rows[0]);
  return `${[
    columns.join(','),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(',')),
  ].join('\n')}\n`;
}

export async function writeSourceSeed({ seed = 20260720, outputDirectory } = {}) {
  const output = outputDirectory ?? new URL('../../artifacts/source-seed/', import.meta.url);
  const sourceSeed = generateSourceSeed(seed);
  await mkdir(output, { recursive: true });

  const tables = {};
  for (const [tableName, rows] of Object.entries(sourceSeed.tables)) {
    const json = `${JSON.stringify(rows, null, 2)}\n`;
    const csv = toCsv(rows);
    await Promise.all([
      writeFile(new URL(`${tableName}.json`, output), json),
      writeFile(new URL(`${tableName}.csv`, output), csv),
    ]);
    tables[tableName] = {
      rowCount: rows.length,
      jsonFile: `${tableName}.json`,
      jsonSha256: sha256(json),
      csvFile: `${tableName}.csv`,
      csvSha256: sha256(csv),
    };
  }

  const manifest = {
    fixtureVersion: sourceSeed.fixtureVersion,
    seed: sourceSeed.seed,
    SyntheticData: true,
    sourceDocument: sourceSeed.sourceDocument,
    tableCount: Object.keys(tables).length,
    caseCount: sourceSeed.tables.CaseMaster.length,
    tables,
  };
  await writeFile(new URL('manifest.json', output), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = await writeSourceSeed();
  console.log(
    `PASS: wrote ${manifest.tableCount} JSON files, ${manifest.tableCount} CSV files, `
    + `and one manifest for ${manifest.caseCount} synthetic FIRs.`,
  );
}
