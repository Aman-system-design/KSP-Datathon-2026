import { createHash } from 'node:crypto';

import { deepFreeze, normalizeDatasetDefinition, normalizeMapViewDefinition } from '@ksp/geospatial-core';

import { fail } from '../services/errors.mjs';
import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { DATASET_CATALOG } from './dataset-catalog.mjs';

const CREATE_KEYS = new Set(['name', 'visibility', 'definition']);
const UPDATE_KEYS = new Set(['expectedVersion', 'name', 'visibility', 'definition']);
const PUBLISHED = new Set(['ROLE_DEFAULT', 'ORGANIZATION_GLOBAL']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;

const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const hasAction = (access, action) => access?.actions?.includes(action) === true;
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

function requireActor(access) {
  if (typeof access?.organizationId !== 'string' || !ID_PATTERN.test(access.organizationId)
    || (!Number.isSafeInteger(access.employeeId) && !/^[1-9]\d*$/u.test(String(access.employeeId ?? '')))) {
    fail('FORBIDDEN_ACTION');
  }
}

function strictBody(body, allowed) {
  if (!plain(body) || Object.keys(body).some(key => !allowed.has(key))) fail('INVALID_REQUEST');
  if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 128) fail('INVALID_REQUEST');
  if (typeof body.visibility !== 'string' || !plain(body.definition)) fail('INVALID_REQUEST');
}

function referencedDatasets(definition) {
  return new Set([
    ...(Array.isArray(definition?.layers) ? definition.layers.map(layer => layer?.datasetId) : []),
    ...(plain(definition?.globalFilters) ? Object.keys(definition.globalFilters) : []),
  ]);
}

function requireDatasetActions(access, definition) {
  for (const id of referencedDatasets(definition)) {
    const dataset = DATASET_CATALOG.find(candidate => candidate.id === id);
    if (!dataset) fail('INVALID_REQUEST');
    if (!hasAction(access, dataset.requiredAction)) fail('FORBIDDEN_ACTION');
  }
}

function catalogFor(definition) {
  for (const id of referencedDatasets(definition)) {
    const dataset = DATASET_CATALOG.find(candidate => candidate.id === id);
    if (!dataset) fail('INVALID_REQUEST');
  }
  try {
    return new Map(DATASET_CATALOG.filter(dataset => dataset.spatialStatus === 'AVAILABLE').map(dataset => {
      const { service, spatialStatus, missingRequiredFields, ...contract } = dataset;
      return [dataset.id, normalizeDatasetDefinition(contract)];
    }));
  } catch { fail('INVALID_REQUEST'); }
}

function normalizeDefinition(body, expectedVersion) {
  if (body.definition.name !== body.name || body.definition.visibility !== body.visibility
    || body.definition.version !== expectedVersion) fail('INVALID_REQUEST');
  const catalog = catalogFor(body.definition);
  try { return normalizeMapViewDefinition(body.definition, catalog); }
  catch { fail('INVALID_REQUEST'); }
}

function serialized(normalized) {
  const json = canonicalStringify(normalized);
  return { json, hash: sha256(json) };
}

function visibleTo(row, definition, access) {
  return definition.visibility !== 'PRIVATE' || String(row.OwnerEmployeeID) === String(access.employeeId);
}

function response(row, definition, requestId) {
  return deepFreeze({
    data: {
      id: row.MapViewID, organizationId: row.OrganizationID, ownerEmployeeId: row.OwnerEmployeeID,
      name: definition.name, visibility: definition.visibility, version: definition.version, definition,
    },
    meta: { requestId },
  });
}

async function currentDefinition(repository, row, access) {
  const version = await repository.getMapViewVersion(row.MapViewID, row.CurrentVersion, access.organizationId);
  if (!version || typeof version.DefinitionJSON !== 'string'
    || sha256(version.DefinitionJSON) !== version.DefinitionHash) fail('DATA_NOT_READY');
  let parsed;
  try { parsed = JSON.parse(version.DefinitionJSON); } catch { fail('DATA_NOT_READY'); }
  const normalized = normalizeDefinition({
    name: parsed.name, visibility: parsed.visibility, definition: parsed,
  }, row.CurrentVersion);
  if (canonicalStringify(normalized) !== version.DefinitionJSON) fail('DATA_NOT_READY');
  return normalized;
}

export function createMapViewService({ repository, clock }) {
  for (const method of ['listMapViews', 'getMapView', 'getMapViewVersion', 'createMapView', 'updateMapView']) {
    if (typeof repository?.[method] !== 'function') throw new TypeError(`repository.${method} is required`);
  }
  if (typeof clock !== 'function') throw new TypeError('clock is required');

  const get = async ({ access, params, requestId, hidePrivate = true }) => {
    requireActor(access);
    if (!ID_PATTERN.test(params?.mapViewId ?? '')) fail('INVALID_REQUEST');
    const row = await repository.getMapView(params.mapViewId, access.organizationId);
    if (!row) fail('NOT_FOUND');
    const definition = await currentDefinition(repository, row, access);
    if (hidePrivate && !visibleTo(row, definition, access)) fail('NOT_FOUND');
    requireDatasetActions(access, definition);
    return response(row, definition, requestId);
  };

  return Object.freeze({
    async listMapViews({ access, query = {}, requestId }) {
      requireActor(access);
      const page = await repository.listMapViews({
        organizationId: access.organizationId, limit: 200,
        ...(typeof query.nextToken === 'string' ? { nextToken: query.nextToken } : {}),
      });
      const items = [];
      for (const row of page.data ?? []) {
        try {
          const definition = await currentDefinition(repository, row, access);
          if (visibleTo(row, definition, access)) {
            requireDatasetActions(access, definition);
            items.push(response(row, definition).data);
          }
        } catch (error) {
          if (error?.code !== 'FORBIDDEN_ACTION') throw error;
        }
      }
      return deepFreeze({ data: { items, nextToken: page.nextToken ?? null }, meta: { requestId } });
    },

    getMapView: get,

    async createMapView({ access, body, requestId }) {
      requireActor(access);
      if (!hasAction(access, 'CREATE_MAP_VIEW')) fail('FORBIDDEN_ACTION');
      strictBody(body, CREATE_KEYS);
      if (PUBLISHED.has(body.visibility) && !hasAction(access, 'MANAGE_MAP_VIEWS')) fail('FORBIDDEN_ACTION');
      const definition = normalizeDefinition(body, 1);
      requireDatasetActions(access, definition);
      const { json, hash } = serialized(definition);
      const timestamp = clock();
      const mapView = {
        MapViewID: definition.id, OrganizationID: access.organizationId, Name: definition.name,
        OwnerEmployeeID: access.employeeId, Visibility: definition.visibility, CurrentVersion: 1,
        Status: 'ACTIVE', CreatedAt: timestamp, UpdatedAt: timestamp,
        SyntheticData: access.syntheticData === true,
      };
      await repository.createMapView({ mapView, version: {
        MapViewVersionKey: `${definition.id}:1`, MapViewID: definition.id,
        OrganizationID: access.organizationId, Version: 1, DefinitionJSON: json, DefinitionHash: hash,
        ...(PUBLISHED.has(definition.visibility) ? { PublishedAt: timestamp } : {}),
        CreatedByEmployeeID: access.employeeId, CreatedAt: timestamp,
        SyntheticData: access.syntheticData === true,
      } });
      return response(mapView, definition, requestId);
    },

    async updateMapView({ access, params, body, requestId }) {
      requireActor(access);
      strictBody(body, UPDATE_KEYS);
      if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) fail('INVALID_REQUEST');
      const existing = await get({ access, params, requestId, hidePrivate: false });
      const owner = String(existing.data.ownerEmployeeId) === String(access.employeeId);
      const managed = hasAction(access, 'MANAGE_MAP_VIEWS');
      if ((!owner || !hasAction(access, 'EDIT_OWN_MAP_VIEW')) && !managed) fail('FORBIDDEN_ACTION');
      if ((PUBLISHED.has(existing.data.visibility) || PUBLISHED.has(body.visibility)) && !managed) fail('FORBIDDEN_ACTION');
      if (existing.data.version !== body.expectedVersion) fail('VERSION_CONFLICT');
      const definition = normalizeDefinition(body, body.expectedVersion + 1);
      requireDatasetActions(access, definition);
      if (definition.id !== existing.data.id) fail('INVALID_REQUEST');
      const { json, hash } = serialized(definition);
      const timestamp = clock();
      const row = await repository.updateMapView({
        mapViewId: existing.data.id, organizationId: access.organizationId,
        expectedVersion: body.expectedVersion,
        nextVersion: {
          MapViewVersionKey: `${existing.data.id}:${definition.version}`, MapViewID: existing.data.id,
          OrganizationID: access.organizationId, Version: definition.version,
          DefinitionJSON: json, DefinitionHash: hash,
          ...(PUBLISHED.has(definition.visibility) ? { PublishedAt: timestamp } : {}),
          CreatedByEmployeeID: access.employeeId, CreatedAt: timestamp,
          SyntheticData: access.syntheticData === true,
        },
      });
      if (!row) fail('NOT_FOUND');
      return response(row, definition, requestId);
    },
  });
}
