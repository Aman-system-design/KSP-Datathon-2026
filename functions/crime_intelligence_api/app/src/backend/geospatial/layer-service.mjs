import { compileLayerExecution, deepFreeze, MAX_FEATURES } from '../../../vendor/geospatial-core/index.mjs';

import { fail } from '../services/errors.mjs';
import { DATASET_CATALOG } from './dataset-catalog.mjs';

const EXECUTION_KEYS = new Set(['layer', 'runtime']);
const RENDER_USES = new Set(['display', 'label', 'weight', 'color', 'size']);
const SEMANTIC_LIMIT = 200;
const EVIDENCE_CASE_LIMIT = 200;
const MAX_PAGES = Math.ceil(MAX_FEATURES / SEMANTIC_LIMIT);

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function publicDataset(dataset) {
  const { sourceReference, service, requiredAction, ...visible } = dataset;
  return deepFreeze({ ...structuredClone(visible), access: { actions: [requiredAction] } });
}

function requireAction(access, action) {
  if (!access?.actions?.includes(action)) fail('FORBIDDEN_ACTION');
}

function normalizedExecution(body, dataset) {
  if (!plain(body) || Object.keys(body).some(key => !EXECUTION_KEYS.has(key)) || !plain(body.layer) || !plain(body.runtime)) {
    fail('INVALID_REQUEST');
  }
  try {
    const { service, spatialStatus, missingRequiredFields, ...definition } = dataset;
    const plan = compileLayerExecution({ dataset: definition, layer: body.layer, runtime: body.runtime });
    return deepFreeze({ ...plan, limit: Math.min(plan.limit, SEMANTIC_LIMIT) });
  } catch { fail('INVALID_REQUEST'); }
}

function valueAt(row, field) {
  if (field === 'latitude') return row.centroid?.latitude;
  if (field === 'longitude') return row.centroid?.longitude;
  return row[field];
}

function projectProperties(row, plan, dataset) {
  const properties = { id: row.id };
  for (const field of plan.fields) {
    if (field === 'id' || !dataset.fields[field]?.uses.some(use => RENDER_USES.has(use))) continue;
    const value = valueAt(row, field);
    if (value !== undefined) properties[field] = structuredClone(value);
  }
  if (Array.isArray(row.evidenceCaseIds)) {
    properties.evidenceCaseIds = row.evidenceCaseIds
      .filter(value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(value))
      .slice(0, EVIDENCE_CASE_LIMIT);
  }
  return properties;
}

function predicate(actual, expected) {
  if (!plain(expected)) return Object.is(actual, expected);
  return Object.entries(expected).every(([operator, value]) => {
    if (operator === '$eq') return Object.is(actual, value);
    if (operator === '$ne') return !Object.is(actual, value);
    if (operator === '$gt') return actual > value;
    if (operator === '$gte') return actual >= value;
    if (operator === '$lt') return actual < value;
    if (operator === '$lte') return actual <= value;
    if (operator === '$in') return value.some(item => Object.is(actual, item));
    if (operator === '$nin') return value.every(item => !Object.is(actual, item));
    return false;
  });
}

function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(child => matches(row, child));
    if (key === '$or') return value.some(child => matches(row, child));
    if (key === '$not') return !matches(row, value);
    return predicate(valueAt(row, key), value);
  });
}

function inViewport(longitude, latitude, viewport) {
  const bounds = viewport?.bounds;
  return !bounds || (longitude >= bounds[0] && longitude <= bounds[2] && latitude >= bounds[1] && latitude <= bounds[3]);
}

function inTimeWindow(row, dataset, timeWindow) {
  if (!timeWindow) return true;
  const value = valueAt(row, dataset.timeField);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(timeWindow.from) && timestamp <= Date.parse(timeWindow.to);
}

function queryFor(plan, access, nextToken) {
  return Object.fromEntries([
    ['limit', SEMANTIC_LIMIT], ['nextToken', nextToken],
    ['unitId', access.scopeUnitId],
    ['from', plan.timeWindow?.from], ['to', plan.timeWindow?.to],
    ['bounds', plan.viewport?.bounds?.join(',')],
  ].filter(([, value]) => value !== undefined));
}

function snapshotFingerprint(meta) {
  const source = plain(meta) ? meta : {};
  const period = plain(source.observationPeriod) ? source.observationPeriod : {};
  const field = (object, key) => Object.hasOwn(object, key)
    ? { present: true, value: object[key] } : { present: false };
  return JSON.stringify({
    analysisRunId: field(source, 'analysisRunId'),
    runGroupId: field(source, 'runGroupId'),
    observationPeriod: { present: Object.hasOwn(source, 'observationPeriod') },
    observationFrom: field(period, 'from'), observationTo: field(period, 'to'),
    methodVersion: field(source, 'methodVersion'), engineVersion: field(source, 'engineVersion'),
    syntheticData: field(source, 'syntheticData'), dataQualityStatus: field(source, 'dataQualityStatus'),
  });
}

function freshnessState(status, runGroupId) {
  const currentId = status?.currentRunGroup?.RunGroupID;
  if (currentId !== runGroupId) return 'STALE';
  const latest = status?.latestAttempt;
  if (!latest || latest.runGroupId === currentId || latest.status === 'COMPLETED') return 'CURRENT';
  if (latest.status === 'FAILED_RETRYABLE' || latest.status === 'FAILED_FINAL') return 'REFRESH_FAILED';
  return 'REFRESHING';
}

function runMetadata(status, runGroupId) {
  const group = status?.currentRunGroup?.RunGroupID === runGroupId ? status.currentRunGroup : undefined;
  const run = group?.runs?.find(row => row.AnalysisType === 'HOTSPOT') ?? group?.runs?.[0];
  return { group, run };
}

function metadata({ envelope, rows, features, omittedFeatureCount, clock, requestId, scanTruncated, refreshStatus }) {
  const sourceMeta = plain(envelope.meta) ? structuredClone(envelope.meta) : {};
  const limitations = [...new Set([
    ...(Array.isArray(sourceMeta.limitations) ? sourceMeta.limitations : []),
    ...rows.flatMap(row => Array.isArray(row.limitations) ? row.limitations : []),
    ...(rows.some(row => Array.isArray(row.evidenceCaseIds) && row.evidenceCaseIds.length > EVIDENCE_CASE_LIMIT)
      ? ['EVIDENCE_CASE_IDS_TRUNCATED'] : []),
    ...(scanTruncated ? ['GEOSPATIAL_SCAN_LIMIT_REACHED'] : []),
  ])].sort();
  const recordMethodVersion = rows.find(row => typeof row.version === 'string')?.version;
  if (!sourceMeta.generatedAt) {
    const generatedAt = clock();
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) throw new TypeError('clock must return a valid Date');
    sourceMeta.generatedAt = generatedAt.toISOString();
  }
  const runGroupId = sourceMeta.runGroupId ?? sourceMeta.analysisRunId;
  const { group, run } = runMetadata(refreshStatus, runGroupId);
  const observationStart = sourceMeta.observationPeriod?.from ?? run?.ObservationStart;
  const observationEnd = sourceMeta.observationPeriod?.to ?? run?.ObservationEnd;
  const engineVersion = sourceMeta.engineVersion ?? sourceMeta.methodVersion ?? run?.EngineVersion ?? recordMethodVersion;
  return deepFreeze({
    ...sourceMeta,
    ...(sourceMeta.requestId && sourceMeta.requestId !== requestId ? { sourceRequestId: sourceMeta.requestId } : {}),
    requestId, runGroupId,
    publishedAt: sourceMeta.publishedAt ?? group?.PublishedAt ?? run?.PublishedAt ?? null,
    observationStart: observationStart ?? null, observationEnd: observationEnd ?? null,
    observationWindow: sourceMeta.observationPeriod,
    engineVersion: engineVersion ?? null,
    ...(recordMethodVersion ? { recordMethodVersion } : {}),
    sourceRecordCount: rows.length, outputFeatureCount: features.length, omittedFeatureCount,
    resultComplete: !scanTruncated, scanTruncated, limitations,
    freshnessState: freshnessState(refreshStatus, runGroupId),
  });
}

export function createGeospatialLayerService({ repository, readServices, clock }) {
  if (!readServices || typeof clock !== 'function'
    || typeof repository?.getCurrentRunGroup !== 'function'
    || typeof repository?.getRefreshStatus !== 'function') {
    throw new TypeError('repository, readServices and clock are required');
  }
  const sources = new Map(DATASET_CATALOG.flatMap(dataset => (
    Object.hasOwn(readServices, dataset.service) && typeof readServices[dataset.service] === 'function'
      ? [[dataset.sourceReference, readServices[dataset.service].bind(readServices)]] : []
  )));

  return Object.freeze({
    async listDatasets({ access, requestId }) {
      const items = DATASET_CATALOG.filter(dataset => access?.actions?.includes(dataset.requiredAction)).map(publicDataset);
      const generatedAt = clock();
      return deepFreeze({
        data: { items }, meta: { requestId, generatedAt: generatedAt.toISOString() },
      });
    },

    async getFreshness({ access, requestId, query = {} }) {
      const status = await repository.getRefreshStatus();
      const group = status?.currentRunGroup;
      if (!group) fail('DATA_NOT_READY');
      const generation = Number(status.publicationGeneration ?? group.PublicationGeneration ?? 0);
      const knownGeneration = query.knownGeneration === undefined ? undefined : Number(query.knownGeneration);
      if (knownGeneration !== undefined && (!Number.isSafeInteger(knownGeneration) || knownGeneration < 0)) fail('INVALID_REQUEST');
      const unchanged = knownGeneration === generation;
      const layers = DATASET_CATALOG
        .filter(dataset => access?.actions?.includes(dataset.requiredAction))
        .filter(() => !unchanged)
        .map(dataset => {
          const run = group.runs.find(row => row.AnalysisType === ({
            hotspots: 'HOTSPOT', anomalies: 'ANOMALY', areaRisk: 'AREA_RISK', alerts: 'PATTERN',
          })[dataset.id]) ?? group.runs[0];
          return {
            datasetId: dataset.id, version: run.EngineVersion, runGroupId: group.RunGroupID,
            publishedAt: group.PublishedAt, observationStart: run.ObservationStart,
            observationEnd: run.ObservationEnd, state: freshnessState(status, group.RunGroupID),
          };
        });
      return deepFreeze({
        data: { layers },
        meta: { requestId, publicationGeneration: generation, etag: `pub-${generation}`, unchanged },
        ...(unchanged ? { auditMode: 'COALESCED_UNCHANGED' } : {}),
      });
    },

    async executeLayer({ access, body, requestId }) {
      const datasetId = plain(body?.layer) ? body.layer.datasetId : undefined;
      const dataset = DATASET_CATALOG.find(candidate => candidate.id === datasetId);
      if (!dataset) fail('INVALID_REQUEST');
      requireAction(access, dataset.requiredAction);
      if (dataset.spatialStatus !== 'AVAILABLE') fail('DATA_NOT_READY');
      const plan = normalizedExecution(body, dataset);
      if (plan.timeWindow && !dataset.timeField) fail('INVALID_REQUEST');
      const source = sources.get(plan.sourceReference);
      if (!source) throw new TypeError('unconfigured geospatial source');
      const snapshot = await repository.getCurrentRunGroup();
      if (!snapshot) fail('DATA_NOT_READY');
      let envelope;
      let nextToken;
      let pageCount = 0;
      let scanTruncated = false;
      let governingFingerprint;
      const seenTokens = new Set();
      const rows = [];
      const features = [];
      let omittedFeatureCount = 0;
      while (features.length < plan.limit) {
        if (pageCount >= MAX_PAGES) { scanTruncated = true; break; }
        const page = await source({ access, params: {}, query: queryFor(plan, access, nextToken), snapshot });
        pageCount += 1;
        const pageFingerprint = snapshotFingerprint(page?.meta);
        if (governingFingerprint === undefined) governingFingerprint = pageFingerprint;
        else if (governingFingerprint !== pageFingerprint) fail('DATA_NOT_READY');
        envelope ??= page;
        const items = page?.data?.items;
        if (!Array.isArray(items)) fail('DATA_NOT_READY');
        let consumed = 0;
        for (const row of items) {
          if (rows.length >= MAX_FEATURES) { scanTruncated = true; break; }
          rows.push(row); consumed += 1;
          const longitude = valueAt(row, dataset.geometry.longitudeField);
          const latitude = valueAt(row, dataset.geometry.latitudeField);
          if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
            || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            omittedFeatureCount += 1; continue;
          }
          if (!inViewport(longitude, latitude, plan.viewport)
            || !inTimeWindow(row, dataset, plan.timeWindow) || !matches(row, plan.filter)) continue;
          features.push(deepFreeze({
            type: 'Feature', id: row.id,
            geometry: { type: 'Point', coordinates: [longitude, latitude] },
            properties: projectProperties(row, plan, dataset),
          }));
          if (features.length >= plan.limit) break;
        }
        if (features.length >= plan.limit) break;
        const returnedToken = page.data.nextToken;
        if (rows.length >= MAX_FEATURES) {
          scanTruncated ||= consumed < items.length || returnedToken !== undefined;
          break;
        }
        if (returnedToken === undefined || returnedToken === null || returnedToken === '') break;
        if (typeof returnedToken !== 'string' || seenTokens.has(returnedToken)) fail('DATA_NOT_READY');
        seenTokens.add(returnedToken);
        nextToken = returnedToken;
      }
      if (!scanTruncated && features.length === 0 && omittedFeatureCount === rows.length && rows.length > 0) fail('DATA_NOT_READY');
      const refreshStatus = await repository.getRefreshStatus();
      return deepFreeze({
        data: { type: 'FeatureCollection', features },
        meta: metadata({ envelope, rows, features, omittedFeatureCount, clock, requestId, scanTruncated, refreshStatus }),
      });
    },
  });
}
