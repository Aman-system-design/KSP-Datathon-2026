import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';

import { buildFunctionBundle } from '../../scripts/catalyst/build-functions.mjs';
import { inspectBundle } from '../../scripts/catalyst/inspect-bundle.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const expectedFunctions = Object.freeze([
  {
    name: 'crime_intelligence_api',
    stack: 'node24',
    type: 'advancedio',
    dependencies: { express: '5.1.0', 'zcatalyst-sdk-node': '^2.5.0' },
  },
  {
    name: 'intelligence_refresh',
    stack: 'node18',
    type: 'job',
    dependencies: { 'zcatalyst-sdk-node': '^2.5.0' },
  },
]);
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));
}

test('Catalyst declares exactly the two approved Function targets', () => {
  const manifest = readJson('catalyst.json');
  assert.deepEqual(manifest.functions.targets, expectedFunctions.map(({ name }) => name));
});

test('Function manifests lock the approved name, runtime, type and entry', () => {
  for (const expected of expectedFunctions) {
    const root = `functions/${expected.name}`;
    const config = readJson(`${root}/catalyst-config.json`);
    assert.equal(config.deployment.name, expected.name);
    assert.match(config.deployment.stack, new RegExp(`^${expected.stack}$`, 'i'));
    assert.match(config.deployment.type, new RegExp(expected.type, 'i'));
    assert.equal(config.execution.main, 'index.cjs');
    assert.equal(existsSync(path.join(repositoryRoot, root, 'index.cjs')), true);
  }
});

test('Function packages use only the approved production dependencies', () => {
  for (const expected of expectedFunctions) {
    const manifest = readJson(`functions/${expected.name}/package.json`);
    assert.equal(manifest.private, true);
    assert.equal(manifest.author, 'KSP Datathon <ksp-datathon@example.invalid>');
    assert.deepEqual(manifest.dependencies, expected.dependencies);
    assert.equal(manifest.devDependencies, undefined);
  }
});

test('generated samples are replaced by explicit fail-closed stubs', () => {
  const api = readFileSync(path.join(repositoryRoot, 'functions/crime_intelligence_api/index.cjs'), 'utf8');
  assert.match(api, /createApiApplication/);
  assert.match(api, /INTERNAL_ERROR/);
  assert.doesNotMatch(api, /Hello from|Hello World|status\s*\(\s*200\s*\)/i);
  const refresh = readFileSync(path.join(repositoryRoot, 'functions/intelligence_refresh/index.cjs'), 'utf8');
  assert.match(refresh, /createRefreshApplication/);
  assert.match(refresh, /INTERNAL_ERROR/);
  assert.doesNotMatch(refresh, /Hello from|Hello World|closeWithSuccess/i);
});

test('Function roots contain no installed dependencies or personal metadata', () => {
  const files = execFileSync('git', [
    'ls-files', '--cached', '--others', '--exclude-standard', '--', 'functions',
  ], { cwd: repositoryRoot, encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.equal(files.some((file) => file.split('/').includes('node_modules')), false);

  const text = files
    .filter((file) => /\.(?:c?js|json)$/i.test(file))
    .map((file) => readFileSync(path.join(repositoryRoot, file), 'utf8'))
    .join('\n');
  assert.doesNotMatch(text, /@(?!example\.invalid\b)(?:gmail|outlook|hotmail|yahoo|zoho)\.[a-z]+/i);
});

test('builds deterministic self-contained API and refresh application bundles', () => {
  for (const target of ['api', 'refresh']) {
    const firstRoot = mkdtempSync(path.join(os.tmpdir(), `ksp-${target}-a-`));
    const secondRoot = mkdtempSync(path.join(os.tmpdir(), `ksp-${target}-b-`));
    temporaryRoots.push(firstRoot, secondRoot);

    const first = buildFunctionBundle({ target, repositoryRoot, functionRoot: firstRoot });
    const second = buildFunctionBundle({ target, repositoryRoot, functionRoot: secondRoot });
    assert.deepEqual(first, second);
    assert.deepEqual(first.files.map(({ path: file }) => file), [...first.files.map(({ path: file }) => file)].sort());

    for (const file of first.files) {
      const bytes = readFileSync(path.join(firstRoot, 'app', file.path));
      assert.equal(file.bytes, bytes.byteLength);
      assert.equal(file.sha256, createHash('sha256').update(bytes).digest('hex'));
    }

    const inspection = inspectBundle({ functionRoot: firstRoot });
    assert.equal(inspection.valid, true);
    assert.equal(inspection.unresolvedImports.length, 0);
    assert.equal(inspection.forbiddenFiles.length, 0);
  }
});

test('bundle inventory excludes test/evaluation material and includes approved runtime assets', () => {
  const apiRoot = mkdtempSync(path.join(os.tmpdir(), 'ksp-api-assets-'));
  const refreshRoot = mkdtempSync(path.join(os.tmpdir(), 'ksp-refresh-assets-'));
  temporaryRoots.push(apiRoot, refreshRoot);
  const api = buildFunctionBundle({ target: 'api', repositoryRoot, functionRoot: apiRoot });
  const refresh = buildFunctionBundle({ target: 'refresh', repositoryRoot, functionRoot: refreshRoot });
  const apiPaths = api.files.map(file => file.path);
  const refreshPaths = refresh.files.map(file => file.path);
  const allPaths = [...apiPaths, ...refreshPaths].join('\n');

  assert.match(apiPaths.join('\n'), /src\/backend\/http\/dispatch\.mjs/);
  assert.match(refreshPaths.join('\n'), /src\/backend\/refresh\/refresh-service\.mjs/);
  assert.match(refreshPaths.join('\n'), /vendor\/intelligence-core\/index\.mjs/);
  assert.doesNotMatch(refreshPaths.join('\n'), /vendor\/intelligence-core\/src\/evaluate\.mjs/);
  assert.match(refreshPaths.join('\n'), /data\/synthetic-demo-input\.json/);
  assert.match(refreshPaths.join('\n'), /data\/synthetic-identity-authority\.json/);
  assert.match(apiPaths.join('\n'), /schema\/catalyst\/pdf-semantic-contract\.json/);
  assert.match(refreshPaths.join('\n'), /schema\/catalyst\/pdf-semantic-contract\.json/);
  assert.match(allPaths, /config\/access-policy\.json/);
  assert.doesNotMatch(allPaths, /(?:^|\/)(?:fixtures|tests|docs|artifacts|\.git)(?:\/|$)/i);
  assert.doesNotMatch(allPaths, /hidden[-_]?truth|token|credential|secret/i);
});
