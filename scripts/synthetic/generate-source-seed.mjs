import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';
import { STATEWIDE_OUTPUT_DIRECTORY, statewideSourceOptions } from './statewide-profile.mjs';

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

export async function writeSourceSeed({ seed = 20260720, caseCount = 50, profile = 'smoke', outputDirectory } = {}) {
  const output = outputDirectory ?? (profile === 'statewide'
    ? STATEWIDE_OUTPUT_DIRECTORY
    : new URL('../../artifacts/source-seed/', import.meta.url));
  const sourceSeed = generateSourceSeed({ seed, caseCount, profile });
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
    districtCount: sourceSeed.tables.District.length,
    stationCount: sourceSeed.tables.Unit.filter(row => row.TypeID === 3).length,
    scenarioCounts: sourceSeed.truth ? {
      hotspots: sourceSeed.truth.hotspots.length,
      patterns: sourceSeed.truth.patterns.length,
      anomalies: sourceSeed.truth.anomalies.length,
      negativeControls: sourceSeed.truth.negativeControls.length,
    } : null,
    tables,
  };
  await writeFile(new URL('manifest.json', output), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const profileIndex = process.argv.indexOf('--profile');
  const profile = profileIndex >= 0 ? process.argv[profileIndex + 1] : 'smoke';
  if (!['smoke', 'statewide'].includes(profile)) {
    throw new TypeError('profile must be smoke or statewide');
  }
  const manifest = await writeSourceSeed(profile === 'statewide' ? statewideSourceOptions : { profile });
  console.log(
    `PASS: wrote ${manifest.tableCount} JSON files, ${manifest.tableCount} CSV files, `
    + `and one manifest for ${manifest.caseCount} synthetic FIRs across ${manifest.districtCount} districts.`,
  );
}
