import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildFunctionBundle } from '../catalyst/build-functions.mjs';

const EXACT_NODE_VERSION = '18.20.8';
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function invariant(condition, message) {
  if (!condition) throw new Error(`Node 18 compatibility failed: ${message}`);
}

const runtimeRoot = path.join(repositoryRoot, 'tools', 'node18-runtime');
const nodePackage = JSON.parse(readFileSync(path.join(runtimeRoot, 'node_modules/node/package.json'), 'utf8'));
invariant(nodePackage.version === EXACT_NODE_VERSION, `expected node@${EXACT_NODE_VERSION}, found ${nodePackage.version}`);
const binary = path.join(runtimeRoot, 'node_modules', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
const version = spawnSync(binary, ['--version'], { encoding: 'utf8' });
invariant(version.status === 0, version.stderr || 'local Node binary could not start');
invariant(version.stdout.trim() === `v${EXACT_NODE_VERSION}`, `local binary reported ${version.stdout.trim()}`);

const functionRoot = mkdtempSync(path.join(tmpdir(), 'ksp-node18-refresh-'));
try {
  buildFunctionBundle({ target: 'refresh', repositoryRoot, functionRoot });
  copyFileSync(path.join(repositoryRoot, 'functions/intelligence_refresh/index.cjs'), path.join(functionRoot, 'index.cjs'));
  copyFileSync(path.join(repositoryRoot, 'functions/intelligence_refresh/catalyst-config.json'), path.join(functionRoot, 'catalyst-config.json'));
  const result = spawnSync(binary, [
    '--test',
    path.join(repositoryRoot, 'tests/compat/node18-core.test.mjs'),
    path.join(repositoryRoot, 'tests/compat/node18-refresh-runtime.test.mjs'),
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, KSP_NODE18_REFRESH_ROOT: functionRoot },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  invariant(result.status === 0, `compatibility tests exited ${result.status}`);
} finally {
  rmSync(functionRoot, { recursive: true, force: true });
}
