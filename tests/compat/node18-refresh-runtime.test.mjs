import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const bundleRoot = process.env.KSP_NODE18_REFRESH_ROOT;

test('Node 18 loads and executes the deployed refresh Function path', { skip: !bundleRoot }, async () => {
  assert.equal(process.version, 'v18.20.8');
  const moduleUrl = relative => pathToFileURL(path.join(bundleRoot, 'app', relative)).href;
  const [bootstrap, runtime, refresh, repository] = await Promise.all([
    import(moduleUrl('src/backend/catalyst/refresh-bootstrap.mjs')),
    import(moduleUrl('src/backend/catalyst/runtime-config.mjs')),
    import(moduleUrl('src/backend/refresh/refresh-service.mjs')),
    import(moduleUrl('src/backend/repository/catalyst/catalyst-repository.mjs')),
  ]);
  assert.equal(typeof refresh.createRefreshService, 'function');
  assert.equal(typeof repository.CatalystIntelligenceRepository, 'function');

  const environment = {
    KSP_ENVIRONMENT: 'Development', KSP_PROJECT_ID: '43492000000013049',
    KSP_ORGANIZATION_ID: 'ORG-KSP', KSP_PERMISSION_VERSION: '1.0.0',
    KSP_AUDIT_KEY: 'node18-compatibility-audit-key-0001', KSP_AUDIT_KEY_VERSION: 'compat-v1',
    KSP_INTELLIGENCE_JOB_POOL: 'compatibility-only',
  };
  const config = runtime.loadRuntimeConfig(environment);
  const repositoryDouble = {
    async listCommands() { return []; },
    async listAuditEvents() { return []; },
  };
  const closed = [];
  const execute = bootstrap.createRefreshApplication({
    sdk: { initialize() { return {}; } }, config, sourceManifest: { syntheticOnly: true },
    idFactory: prefix => `${prefix}-NODE18`, repositoryFactory: () => repositoryDouble,
    logger: { error() {} },
  });
  const result = await execute(
    { getJobParam: name => name === 'operation' ? 'RECONCILE_GOVERNANCE' : undefined },
    { closeWithSuccess: () => closed.push('success'), closeWithFailure: code => closed.push(code) },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(closed, ['success']);

  Object.assign(process.env, environment);
  const require = createRequire(import.meta.url);
  const Module = require('node:module');
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'zcatalyst-sdk-node') return { initialize() { throw new Error('invalid request must fail before SDK initialization'); } };
    return originalLoad.call(this, request, parent, isMain);
  };
  let handler;
  try { handler = require(path.join(bundleRoot, 'index.cjs')); }
  finally { Module._load = originalLoad; }
  const entryClosed = [];
  const entryResult = await handler(
    { getJobParam: () => 'UNSUPPORTED' },
    { closeWithSuccess: () => entryClosed.push('success'), closeWithFailure: code => entryClosed.push(code) },
  );
  assert.equal(entryResult.ok, false);
  assert.equal(entryResult.error.code, 'INVALID_REQUEST');
  assert.deepEqual(entryClosed, ['INVALID_REQUEST']);
});
