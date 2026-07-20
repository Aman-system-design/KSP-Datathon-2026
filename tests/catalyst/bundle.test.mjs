import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

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
  for (const { name } of expectedFunctions) {
    const source = readFileSync(path.join(repositoryRoot, 'functions', name, 'index.cjs'), 'utf8');
    assert.match(source, /DATA_NOT_READY/);
    assert.doesNotMatch(source, /Hello from|Hello World|status\s*\(\s*200\s*\)/i);
  }
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
