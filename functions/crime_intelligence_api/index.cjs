'use strict';

const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const catalyst = require('zcatalyst-sdk-node');
const express = require('express');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb', strict: true }));

const policy = JSON.parse(readFileSync(path.join(__dirname, 'app', 'config', 'access-policy.json'), 'utf8'));
const handler = Promise.all([
  import('./app/src/backend/catalyst/api-bootstrap.mjs'),
  import('./app/src/backend/catalyst/runtime-config.mjs'),
]).then(([{ createApiApplication }, { loadRuntimeConfig }]) => createApiApplication({
  sdk: catalyst,
  config: loadRuntimeConfig(process.env),
  policy,
  idFactory: prefix => `${prefix}-${randomUUID()}`,
}));

app.use(async (request, response) => {
  try {
    const result = await (await handler)(request);
    response.status(result.status).set('Cache-Control', 'no-store').json(result.body);
  } catch {
    response.status(500).set('Cache-Control', 'no-store').json({
      error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.', requestId: 'REQ-UNAVAILABLE' },
    });
  }
});

app.use((_error, _request, response, _next) => {
  response.status(400).set('Cache-Control', 'no-store').json({
    error: { code: 'INVALID_REQUEST', message: 'The request is invalid.', requestId: 'REQ-UNAVAILABLE' },
  });
});

module.exports = app;
