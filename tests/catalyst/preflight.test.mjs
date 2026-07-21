import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateCatalystPreflight, readCatalystCliVersion } from '../../scripts/catalyst/preflight.mjs';

const projectConfig = Object.freeze({
  projectId: '43492000000013049', projectName: 'KSPDatathon2026',
  organizationId: '60077844198', environmentId: '60077844198',
  environment: 'Development', cliMinimumVersion: '1.27.0', syntheticOnly: true,
  permissionVersion: '1.0.0', apiFunction: 'crime_intelligence_api',
  refreshFunction: 'intelligence_refresh', deploymentBranch: 'codex/intelligence-workspaces',
});

const catalystConfig = Object.freeze({
  defaults: { project: 1, env: 1 }, actives: { project: 1, env: 1 },
  projects: [{
    idx: 1, id: '43492000000013049', name: 'KSPDatathon2026',
    env: [{ idx: 1, id: '60077844198', name: 'Development', type: 3 }],
  }],
});

function input(overrides = {}) {
  return {
    projectConfig, catalystConfig,
    sourceSchema: { tables: Array.from({ length: 29 }, (_, i) => ({ name: `SRC_${i}` })) },
    intelligenceSchema: { tables: Array.from({ length: 28 }, (_, i) => ({ name: `INT_${i}` })) },
    apiOperations: Array.from({ length: 33 }, (_, i) => ({ method: 'GET', path: `/v1/${i}` })),
    cliVersion: '1.27.0', gitStatus: '', branch: 'codex/intelligence-workspaces', remote: true,
    ...overrides,
  };
}

test('preflight locks the approved Development project and inventories', () => {
  const result = evaluateCatalystPreflight(input());
  assert.equal(result.projectId, '43492000000013049');
  assert.equal(result.environment, 'Development');
  assert.equal(result.sourceTableCount, 29);
  assert.equal(result.intelligenceTableCount, 28);
  assert.equal(result.apiOperationCount, 33);
  assert.equal(result.syntheticOnly, true);
  assert.deepEqual(result.git, { branch: 'codex/intelligence-workspaces', clean: true });
});

test('preflight rejects the wrong project or any non-Development environment', () => {
  assert.throws(() => evaluateCatalystPreflight(input({
    catalystConfig: { ...catalystConfig, projects: [{ ...catalystConfig.projects[0], id: '999' }] },
  })), /project/i);
  assert.throws(() => evaluateCatalystPreflight(input({
    projectConfig: { ...projectConfig, environment: 'Production' },
  })), /Production|Development/i);
});

test('preflight rejects unsafe provenance, inventories, CLI and branch state', () => {
  assert.throws(() => evaluateCatalystPreflight(input({ projectConfig: { ...projectConfig, syntheticOnly: false } })), /synthetic/i);
  assert.throws(() => evaluateCatalystPreflight(input({ intelligenceSchema: { tables: [] } })), /28/);
  assert.throws(() => evaluateCatalystPreflight(input({ apiOperations: [] })), /33/);
  assert.throws(() => evaluateCatalystPreflight(input({ cliVersion: '1.26.9' })), /CLI/i);
  assert.throws(() => evaluateCatalystPreflight(input({ gitStatus: ' M unsafe.txt' })), /clean/i);
  assert.throws(() => evaluateCatalystPreflight(input({ branch: 'main' })), /branch/i);
});

test('local preflight reports a dirty tree without authorizing remote mutation', () => {
  const result = evaluateCatalystPreflight(input({ remote: false, gitStatus: ' M local.txt' }));
  assert.equal(result.git.clean, false);
  assert.equal(result.remoteMutationAuthorized, false);
});

test('Windows CLI version lookup uses cmd.exe for the Catalyst batch launcher', () => {
  const calls = [];
  const version = readCatalystCliVersion({
    platform: 'win32',
    execFile(command, args, options) {
      calls.push({ command, args, options });
      return '1.27.0\r\n';
    },
  });
  assert.equal(version, '1.27.0');
  assert.deepEqual(calls[0].command, 'cmd.exe');
  assert.deepEqual(calls[0].args, ['/d', '/s', '/c', 'catalyst.cmd --version']);
});
