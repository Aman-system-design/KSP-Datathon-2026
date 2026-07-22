import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildFunctionBundle } from '../catalyst/build-functions.mjs';

const EXACT_NODE_VERSION = '18.20.8';
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLATFORM_PACKAGES = Object.freeze({
  'linux:x64': 'node-linux-x64',
  'linux:arm64': 'node-linux-arm64',
  'win32:x64': 'node-win-x64',
  'darwin:x64': 'node-darwin-x64',
});

function invariant(condition, message) {
  if (!condition) throw new Error(`Node 18 compatibility failed: ${message}`);
}

const runtimeRoot = path.join(repositoryRoot, 'tools', 'node18-runtime');
const host = `${process.platform}:${process.arch}`;
const packageName = PLATFORM_PACKAGES[host];
invariant(packageName, `unsupported host ${process.platform}/${process.arch}; no network fallback is permitted`);
const packageRoot = path.join(runtimeRoot, 'node_modules', packageName);
const nodePackage = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
invariant(nodePackage.version.replace(/^v/u, '') === EXACT_NODE_VERSION,
  `expected node@${EXACT_NODE_VERSION}, found ${nodePackage.version}`);
invariant(nodePackage.os === process.platform && nodePackage.cpu === process.arch,
  `locked package ${packageName} does not match ${process.platform}/${process.arch}`);
const binary = path.join(packageRoot, 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
invariant(existsSync(binary), `locked binary is missing for ${process.platform}/${process.arch}; run the tool npm ci with --ignore-scripts`);
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
