import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { API_OPERATIONS } from '../../src/backend/http/api-contract.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(`Catalyst preflight failed: ${message}`);
}

function versionParts(value) {
  const match = String(value).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  invariant(match, 'Catalyst CLI version is invalid');
  return match.slice(1).map(Number);
}

function versionAtLeast(actual, minimum) {
  const left = versionParts(actual);
  const right = versionParts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

export function evaluateCatalystPreflight({
  projectConfig, catalystConfig, sourceSchema, intelligenceSchema, apiOperations,
  cliVersion, gitStatus, branch, remote = false,
}) {
  invariant(projectConfig?.environment === 'Development', 'only Development is allowed; Production is prohibited');
  invariant(projectConfig?.syntheticOnly === true, 'synthetic-only provenance is required');
  invariant(typeof projectConfig?.deploymentBranch === 'string' && projectConfig.deploymentBranch,
    'deployment branch is not configured');
  invariant(branch === projectConfig.deploymentBranch, `remote work requires branch ${projectConfig.deploymentBranch}`);

  const projectIndex = catalystConfig?.actives?.project ?? catalystConfig?.defaults?.project;
  const activeProject = catalystConfig?.projects?.find(({ idx }) => idx === projectIndex);
  invariant(String(activeProject?.id) === projectConfig.projectId, 'active Catalyst project does not match approved project');
  invariant(activeProject?.name === projectConfig.projectName, 'active Catalyst project name does not match');
  const environmentIndex = catalystConfig?.actives?.env ?? catalystConfig?.defaults?.env;
  const activeEnvironment = activeProject?.env?.find(({ idx }) => idx === environmentIndex);
  invariant(activeEnvironment?.name === 'Development', 'active Catalyst environment is not Development');
  invariant(String(activeEnvironment?.id) === projectConfig.environmentId, 'active Catalyst environment ID does not match');

  invariant(sourceSchema?.tables?.length === 29, 'source schema must contain exactly 29 tables');
  invariant(intelligenceSchema?.tables?.length === 28, 'intelligence schema must contain exactly 28 tables');
  invariant(apiOperations?.length === 33, 'API contract must contain exactly 33 operations');
  invariant(new Set(apiOperations.map(({ method, path: route }) => `${method} ${route}`)).size === 33, 'API operations must be unique');
  invariant(versionAtLeast(cliVersion, projectConfig.cliMinimumVersion), `Catalyst CLI must be at least ${projectConfig.cliMinimumVersion}`);

  const clean = String(gitStatus ?? '').trim() === '';
  if (remote) invariant(clean, 'Git worktree must be clean before remote mutation');

  return Object.freeze({
    projectId: projectConfig.projectId,
    projectName: projectConfig.projectName,
    organizationId: projectConfig.organizationId,
    environmentId: projectConfig.environmentId,
    environment: activeEnvironment.name,
    cliVersion: String(cliVersion).trim(),
    sourceTableCount: sourceSchema.tables.length,
    intelligenceTableCount: intelligenceSchema.tables.length,
    apiOperationCount: apiOperations.length,
    syntheticOnly: true,
    permissionVersion: projectConfig.permissionVersion,
    functions: Object.freeze([projectConfig.apiFunction, projectConfig.refreshFunction]),
    git: Object.freeze({ branch, clean }),
    remoteMutationAuthorized: Boolean(remote && clean),
  });
}

export function readCatalystCliVersion({
  platform = process.platform, execFile = execFileSync, cwd = process.cwd(),
} = {}) {
  const options = { cwd, encoding: 'utf8' };
  const output = platform === 'win32'
    ? execFile('cmd.exe', ['/d', '/s', '/c', 'catalyst.cmd --version'], options)
    : execFile('catalyst', ['--version'], options);
  return String(output).trim();
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

export async function runCatalystPreflight({ root = process.cwd(), remote = false } = {}) {
  const cliVersion = readCatalystCliVersion({ cwd: root });
  const gitStatus = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], { cwd: root, encoding: 'utf8' });
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  return evaluateCatalystPreflight({
    projectConfig: await readJson(root, 'config/catalyst-development.json'),
    catalystConfig: await readJson(root, '.catalystrc'),
    sourceSchema: await readJson(root, 'schema/catalyst/source-schema.json'),
    intelligenceSchema: await readJson(root, 'schema/catalyst/intelligence-schema.json'),
    apiOperations: API_OPERATIONS,
    cliVersion, gitStatus, branch, remote,
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  runCatalystPreflight({ remote: process.argv.includes('--remote') })
    .then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
