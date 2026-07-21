'use strict';

const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const catalyst = require('zcatalyst-sdk-node');
const express = require('express');

const app = express();
app.disable('x-powered-by');

const policy = JSON.parse(readFileSync(path.join(__dirname, 'app', 'config', 'access-policy.json'), 'utf8'));
const handler = Promise.all([
  import('./app/src/backend/catalyst/api-bootstrap.mjs'),
  import('./app/src/backend/catalyst/runtime-config.mjs'),
]).then(([{ createApiApplication }, { loadRuntimeConfig }]) => createApiApplication({
  sdk: catalyst,
  config: loadRuntimeConfig(process.env),
  policy,
  idFactory: prefix => `${prefix}-${randomUUID()}`,
  logger: console,
}));

const noStore = response => response.set('Cache-Control', 'no-store');
const newRequestId = () => `REQ-${randomUUID()}`;
const boundaryFailure = ({ requestId, method, code = 'INTERNAL_ERROR' }) => {
  console.error(JSON.stringify({ event: 'api_boundary_failed', requestId, method, code }));
};

app.get('/healthz', (_request, response) => {
  noStore(response).json({ status: 'ok' });
});

app.get('/readyz', async (request, response) => {
  const requestId = newRequestId();
  try {
    await handler;
    noStore(response).json({ status: 'ready', requestId });
  } catch {
    boundaryFailure({ requestId, method: request.method });
    noStore(response).status(503).json({ status: 'unavailable', requestId });
  }
});

app.use(express.json({ limit: '256kb', strict: true }));

app.use(async (request, response) => {
  const requestId = newRequestId();
  request.requestId = requestId;
  try {
    const result = await (await handler)(request);
    noStore(response).status(result.status).json(result.body);
  } catch {
    boundaryFailure({ requestId, method: request.method });
    noStore(response).status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.', requestId },
    });
  }
});

app.use((_error, request, response, _next) => {
  const requestId = newRequestId();
  console.info(JSON.stringify({ event: 'api_request_rejected', requestId, method: request.method, code: 'INVALID_REQUEST' }));
  noStore(response).status(400).json({
    error: { code: 'INVALID_REQUEST', message: 'The request is invalid.', requestId },
  });
});

module.exports = app;
