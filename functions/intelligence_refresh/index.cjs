'use strict';

const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const catalyst = require('zcatalyst-sdk-node');

const sourceManifest = JSON.parse(readFileSync(path.join(__dirname, 'app', 'schema', 'source-schema.json'), 'utf8'));
const application = Promise.all([
  import('./app/src/backend/catalyst/refresh-bootstrap.mjs'),
  import('./app/src/backend/catalyst/runtime-config.mjs'),
]).then(([{ createRefreshApplication }, { loadRuntimeConfig }]) => createRefreshApplication({
  sdk: catalyst,
  config: loadRuntimeConfig(process.env),
  sourceManifest,
  idFactory: prefix => `${prefix}-${randomUUID()}`,
}));

module.exports = async (jobRequest, context) => {
  try {
    return await (await application)(jobRequest, context);
  } catch {
    context.closeWithFailure();
    return { ok: false, requestId: 'JOB-UNAVAILABLE', error: { code: 'INTERNAL_ERROR' } };
  }
};
