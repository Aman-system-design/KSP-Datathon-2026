import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import {
  assertNoLeafletReferences, assertRegularContainedFile, scanWebAssets,
  validatePublicationMigration, verifyGeospatial,
} from '../../scripts/ci/verify-geospatial.mjs';

const repositoryUrl = new URL('../../', import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repositoryUrl), 'utf8'));
}

async function readCircleConfig() {
  return parse(await readFile(new URL('.circleci/config.yml', repositoryUrl), 'utf8'));
}

function namedStep(steps, name) {
  return steps.find(step => typeof step === 'object' && Object.hasOwn(step, name))?.[name];
}

test('CircleCI performs one deterministic verification job on a pinned compatible Node image', async () => {
  const [config, repository] = await Promise.all([readCircleConfig(), readJson('package.json')]);
  const job = config.jobs?.verify;
  assert.ok(job, 'verify job must exist');
  assert.deepEqual(config.workflows?.['pull-request-verification']?.jobs, ['verify']);
  assert.ok(job.steps?.includes('checkout'), 'verify job must checkout the repository');

  const image = job.docker?.[0]?.image;
  const match = /^cimg\/node:(\d+)\.(\d+)\.(\d+)$/.exec(image ?? '');
  assert.ok(match, 'Node image must use a pinned full semantic version');
  const engineFloor = Number(/^>=(\d+)$/.exec(repository.engines?.node ?? '')?.[1]);
  assert.ok(Number(match[1]) >= engineFloor, `${image} must satisfy ${repository.engines.node}`);
  assert.equal(repository.scripts?.['geospatial:verify'], 'node scripts/ci/verify-geospatial.mjs');

  assert.equal(namedStep(job.steps, 'run'), 'npm ci');
  const runCommands = job.steps.filter(step => typeof step === 'object' && step.run).map(step => step.run);
  assert.deepEqual(runCommands, [
    'npm ci', 'npm run verify', 'npm run compat:node18', 'npm run geospatial:verify',
  ]);
});

test('CircleCI caches only the npm download cache under the lockfile checksum', async () => {
  const config = await readCircleConfig();
  const steps = config.jobs.verify.steps;
  const restore = namedStep(steps, 'restore_cache');
  const save = namedStep(steps, 'save_cache');
  const expectedKey = 'npm-v1-node24-{{ checksum "package-lock.json" }}';
  assert.deepEqual(restore.keys, [expectedKey]);
  assert.equal(save.key, expectedKey);
  assert.deepEqual(save.paths, ['~/.npm']);
});

test('CircleCI repository config has no deployment or secret injection hooks', async () => {
  const config = await readCircleConfig();
  const serialized = JSON.stringify(config);
  assert.equal(/deploy|release|publish|zcatalyst|catalyst\s+deploy/iu.test(serialized), false);
  assert.equal(/context|environment/iu.test(serialized), false);
  assert.equal(/(?:token|secret|password|credential|private.?key)/iu.test(serialized), false);
  const boundary = await readFile(new URL('docs/runbooks/circleci-verification-security-boundary.md', repositoryUrl), 'utf8');
  assert.match(boundary, /must not contain production secrets/iu);
  assert.match(boundary, /separate.*restricted.*approval/isu);
  assert.match(boundary, /project environment variables.*cannot.*repository/isu);
});

test('geospatial verification validates the canonical repository architecture', async () => {
  const result = await verifyGeospatial(new URL('../../', import.meta.url));
  assert.equal(result.schemaTableCount, 32);
  assert.equal(result.requiredFilesChecked > 10, true);
  assert.equal(result.bundleBudgetWired, true);
  assert.equal(result.generatedFunctionPathsChecked, 0);
});

test('Leaflet removal rejects every JavaScript package loading form', async () => {
  const violations = [
    "import 'leaflet';",
    "import 'leaflet/dist/leaflet.css';",
    "import map from 'leaflet';",
    "await import('react-leaflet');",
    "const map = require('leaflet');",
  ];
  for (const source of violations) {
    await assert.rejects(() => assertNoLeafletReferences(source, 'web/src/example.js'), /imports Leaflet/u);
  }
});

test('Leaflet removal rejects CSS imports and package asset URLs', async () => {
  const violations = [
    '@import "leaflet/dist/leaflet.css";',
    '@import url("leaflet/dist/leaflet.css");',
    '.marker { background-image: url("leaflet/images/marker-icon.png"); }',
  ];
  for (const source of violations) {
    await assert.rejects(() => assertNoLeafletReferences(source, 'web/src/example.css'), /references Leaflet/u);
  }
});

test('Leaflet words in comments and inert strings do not fail the removal check', async () => {
  await assert.doesNotReject(() => assertNoLeafletReferences(`
    // import 'leaflet';
    /* require('react-leaflet'); */
    const migrationNote = "import 'leaflet' was removed";
  `, 'web/src/example.js'));
  await assert.doesNotReject(() => assertNoLeafletReferences(`
    /* @import "leaflet/dist/leaflet.css"; */
    .note::before { content: "url(leaflet/images/marker.png)"; }
  `, 'web/src/example.css'));
});

test('Leaflet removal rejects CDN package URLs by pathname in JavaScript and CSS', async () => {
  const violations = [
    ["import 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';", 'web/src/example.js'],
    ["await import('https://cdn.jsdelivr.net/npm/react-leaflet@5.0.0/+esm');", 'web/src/example.js'],
    ["require('https://esm.sh/v135/leaflet@1.9.4/es2022/leaflet.mjs');", 'web/src/example.js'],
    ['@import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");', 'web/src/example.css'],
    ['@import url("//unpkg.com/leaflet@1.9.4/dist/leaflet.css");', 'web/src/example.css'],
    ['.marker { background: url("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/images/marker.png"); }', 'web/src/example.css'],
  ];
  for (const [source, file] of violations) {
    await assert.rejects(() => assertNoLeafletReferences(source, file), /Leaflet/u);
  }
});

test('Leaflet hostnames, member methods and inert template text do not masquerade as package loads', async () => {
  await assert.doesNotReject(() => assertNoLeafletReferences(`
    const docs = 'https://leaflet.example.com/application.js';
    loader.import('leaflet');
    loader . require('react-leaflet');
    const inert = \`import('leaflet'); require('react-leaflet')\`;
  `, 'web/src/example.js'));
  await assert.doesNotReject(() => assertNoLeafletReferences(`
    @import url("https://leaflet.example.com/application.css");
    .logo { background: url("https://react-leaflet.example.com/logo.svg"); }
  `, 'web/src/example.css'));
});

test('Leaflet removal scans executable template interpolations', async () => {
  await assert.rejects(() => assertNoLeafletReferences(
    'const module = `${await import(\'leaflet\')}`;', 'web/src/example.js',
  ), /imports Leaflet/u);
  await assert.rejects(() => assertNoLeafletReferences(
    'const module = `prefix ${require(\'react-leaflet\')} suffix`;', 'web/src/example.js',
  ), /imports Leaflet/u);
});

test('Leaflet removal scans HTML entry points and JSX resource elements', async () => {
  const violations = [
    ['<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>', 'web/index.html'],
    ['<link rel="stylesheet" href="leaflet/dist/leaflet.css">', 'web/public/embed.html'],
    ['<script src="/vendor/leaflet/dist/leaflet.js"></script>', 'web/public/embed.html'],
    ['<style>@import url("https://esm.sh/leaflet@1.9.4");</style>', 'web/index.html'],
    ['export const CDN = () => <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" />;', 'web/src/cdn.jsx'],
    ["export const CDN = () => <link href={'https://unpkg.com/react-leaflet@5.0.0/style.css'} />;", 'web/src/cdn.tsx'],
  ];
  for (const [source, file] of violations) {
    await assert.rejects(() => assertNoLeafletReferences(source, file), /Leaflet/u);
  }
});

test('recursive web asset scan includes nested public assets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ksp-web-scan-'));
  try {
    await mkdir(path.join(root, 'web/src'), { recursive: true });
    await mkdir(path.join(root, 'web/public/nested'), { recursive: true });
    await writeFile(path.join(root, 'web/index.html'), '<main>clean</main>');
    await writeFile(path.join(root, 'web/src/clean.jsx'), 'export const Clean = () => <main />;');
    await writeFile(path.join(root, 'web/public/nested/legacy.css'), '@import "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";');
    await assert.rejects(() => scanWebAssets(root), /Leaflet/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('recursive web asset scan rejects a directory masquerading as source', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ksp-web-directory-'));
  try {
    await mkdir(path.join(root, 'web/src'), { recursive: true });
    await mkdir(path.join(root, 'web/public/fake.css'), { recursive: true });
    await writeFile(path.join(root, 'web/index.html'), '<main>clean</main>');
    await assert.rejects(() => scanWebAssets(root), /fake\.css.*regular file/iu);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('repository file guard rejects directories and traversal', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'ksp-file-guard-'));
  const root = path.join(parent, 'repository');
  try {
    await mkdir(path.join(root, 'docs/directory.md'), { recursive: true });
    await writeFile(path.join(parent, 'outside.md'), 'outside');
    await assert.rejects(() => assertRegularContainedFile(root, 'docs/directory.md'), /regular file/u);
    await assert.rejects(() => assertRegularContainedFile(root, '../outside.md'), /escapes repository/u);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('repository file guard rejects symlinks when the host supports them', async t => {
  const parent = await mkdtemp(path.join(tmpdir(), 'ksp-symlink-guard-'));
  const root = path.join(parent, 'repository');
  try {
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await writeFile(path.join(parent, 'outside.md'), 'outside');
    try {
      await symlink(path.join(parent, 'outside.md'), path.join(root, 'docs/link.md'), 'file');
    } catch (error) {
      if (!['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) throw error;
      t.skip(`symlink creation is unavailable on this host: ${error.code}`);
      return;
    }
    await assert.rejects(() => assertRegularContainedFile(root, 'docs/link.md'), /symbolic link/u);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('publication migration validation permits future tables but rejects artifact drift', async () => {
  const [schema, migration, migrationState, after] = await Promise.all([
    readJson('schema/catalyst/intelligence-schema.json'),
    readJson('schema/catalyst/migrations/2026-07-22-publication-pointer.json'),
    readJson('schema/catalyst/migrations/2026-07-22-publication-pointer.state.json'),
    readJson('schema/catalyst/migrations/2026-07-22-publication-pointer.after.json'),
  ]);
  const futureSchema = structuredClone(schema);
  futureSchema.tables.push({ name: 'FUTURE_OperationalCapability', columns: [] });
  assert.doesNotThrow(() => validatePublicationMigration({ schema: futureSchema, migration, migrationState, after }));
  assert.throws(() => validatePublicationMigration({
    schema, migration: { ...migration, newTable: 'INT_RewrittenHistory' }, migrationState, after,
  }), /migration artifact/iu);
  assert.throws(() => validatePublicationMigration({
    schema, migration, migrationState, after: { ...after, schemaVersion: 'MUTATED' },
  }), /after-state artifact/iu);
  const missingColumn = structuredClone(schema);
  const pointer = missingColumn.tables.find(table => table.name === 'INT_PublicationState');
  pointer.columns = pointer.columns.filter(column => column.name !== 'PublicationGeneration');
  assert.throws(() => validatePublicationMigration({ schema: missingColumn, migration, migrationState, after }), /PublicationGeneration/u);
  await assert.rejects(() => assertRegularContainedFile(
    fileURLToPath(repositoryUrl), 'schema/catalyst/migrations/missing-publication-pointer.json',
  ), /ENOENT|no such file/iu);
});
