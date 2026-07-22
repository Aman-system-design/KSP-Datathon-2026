import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = async relative => JSON.parse(await readFile(path.join(repositoryRoot, relative), 'utf8'));

test('normal verification and isolated Node 18 use distinct pinned runtimes', async () => {
  const repository = await readJson('package.json');
  const engineFloor = Number(/^>=(\d+)$/.exec(repository.engines.node)?.[1]);
  const runningMajor = Number(process.versions.node.split('.')[0]);
  assert.ok(runningMajor >= engineFloor, `normal tests require ${repository.engines.node}, found ${process.version}`);

  const rootShims = process.platform === 'win32' ? ['node', 'node.cmd', 'node.ps1'] : ['node'];
  for (const name of rootShims) {
    await assert.rejects(access(path.join(repositoryRoot, 'node_modules', '.bin', name)), { code: 'ENOENT' });
  }

  const runtimeRoot = path.join(repositoryRoot, 'tools', 'node18-runtime');
  const packageName = ({
    'linux:x64': 'node-linux-x64', 'linux:arm64': 'node-linux-arm64',
    'win32:x64': 'node-win-x64', 'darwin:x64': 'node-darwin-x64',
  })[`${process.platform}:${process.arch}`];
  assert.ok(packageName, `unsupported compatibility host ${process.platform}/${process.arch}`);
  const binary = path.join(runtimeRoot, 'node_modules', packageName, 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stdout.trim(), 'v18.20.8');
});
