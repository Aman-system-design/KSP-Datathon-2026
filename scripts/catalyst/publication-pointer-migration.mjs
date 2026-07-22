import { createHash } from 'node:crypto';

import { canonicalStringify } from '../../src/backend/workflow/canonical-json.mjs';
import { isCompletePublishedGroup } from '../../src/backend/refresh/run-groups.mjs';

const MODES = new Set(['DRY_RUN', 'APPLY', 'VERIFY', 'ROLLBACK']);
const SHA256 = /^[a-f0-9]{64}$/u;
const clone = value => structuredClone(value);

function invariant(condition, message) {
  if (!condition) throw new Error(`Publication pointer migration failed: ${message}`);
}

function completeGroups(rows) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const group = groups.get(row.RunGroupID) ?? [];
    group.push(row); groups.set(row.RunGroupID, group);
  }
  return [...groups.entries()]
    .filter(([, runs]) => isCompletePublishedGroup(runs))
    .map(([runGroupId, runs]) => ({ runGroupId, runs }))
    .sort((left, right) => left.runGroupId.localeCompare(right.runGroupId));
}

function inventoryDigest(inventory) {
  return createHash('sha256').update(canonicalStringify({
    tables: inventory.tables, analysisRuns: inventory.analysisRuns,
    publicationState: inventory.publicationState,
  })).digest('hex');
}

function parsePointerRuns(pointer) {
  try {
    const runs = JSON.parse(pointer?.CurrentRunsJSON ?? 'null');
    return Array.isArray(runs) ? runs : [];
  } catch { return []; }
}

function verifyPointer({ manifest, inventory, groups, tables }) {
  const pointer = inventory.publicationState;
  const pointerRuns = parsePointerRuns(pointer);
  const storedById = new Map((inventory.analysisRuns ?? []).map(run => [run.AnalysisRunID, run]));
  const required = new Set(manifest.requiredAnalysisTypes);
  const identities = new Set(pointerRuns.map(run => run.AnalysisRunID));
  const types = new Set(pointerRuns.map(run => run.AnalysisType));
  const safePositive = value => Number.isSafeInteger(Number(value)) && Number(value) >= 1;
  const generation = Number(pointer?.PublicationGeneration);
  const latestSequence = Number(pointer?.LatestAttemptSequence);
  const lastReserved = Number(pointer?.LastReservedAttemptSequence);
  const rowsMatch = pointerRuns.length === 7 && identities.size === 7 && types.size === 7
    && [...required].every(type => types.has(type))
    && pointerRuns.every(run => {
      const stored = storedById.get(run.AnalysisRunID);
      return stored
        && stored.RunGroupID === pointer.CurrentRunGroupID
        && run.RunGroupID === pointer.CurrentRunGroupID
        && stored.AnalysisType === run.AnalysisType
        && stored.Status === 'COMPLETED' && stored.PublishStatus === 'PUBLISHED'
        && Number(stored.PublicationGeneration) === generation
        && Number(run.PublicationGeneration) === generation
        && Number(stored.AttemptSequence) === latestSequence
        && Number(run.AttemptSequence) === latestSequence
        && stored.RequestHash === run.RequestHash;
    });
  const requestHashes = new Set(pointerRuns.map(run => run.RequestHash));
  const requestIdentityReady = requestHashes.size === 1
    && [...requestHashes].every(value => value === manifest.legacyUnknownRequestHash || SHA256.test(value));
  const sequenceReady = safePositive(pointer?.PointerVersion) && safePositive(generation)
    && safePositive(latestSequence) && safePositive(lastReserved) && latestSequence <= lastReserved
    && pointer?.LatestAttemptStatus === 'COMPLETED'
    && pointer?.LatestAttemptRunGroupID === pointer?.CurrentRunGroupID;
  const pointerReady = tables.has(manifest.newTable)
    && pointer?.PublicationStateID === 'CURRENT'
    && groups.some(group => group.runGroupId === pointer?.CurrentRunGroupID)
    && rowsMatch && requestIdentityReady && sequenceReady;
  return { pointerReady, pointerRunCount: pointerRuns.length, rowsMatch, requestIdentityReady, sequenceReady };
}

export function planPublicationPointerMigration({ manifest, inventory, mode, confirmed = false }) {
  invariant(MODES.has(mode), 'mode is invalid');
  invariant(inventory?.environment === manifest?.environment, 'only the approved Development environment is allowed');
  invariant(String(inventory?.projectId) === String(manifest?.projectId), 'project does not match the migration manifest');
  const tables = new Map((inventory.tables ?? []).map(table => [table.name, new Set(table.columns ?? [])]));
  const missingLegacy = manifest.legacyRequiredTables.filter(name => !tables.has(name));
  invariant(missingLegacy.length === 0, `legacy inventory is missing ${missingLegacy[0]}`);
  const groups = completeGroups(inventory.analysisRuns);
  const result = {
    migrationId: manifest.migrationId, mode,
    inventory: {
      existingTableCount: tables.size, targetTableCount: manifest.toTableCount,
      digest: inventoryDigest(inventory),
    },
    legacy: { completeRunGroupIds: groups.map(group => group.runGroupId) },
    actions: [],
  };

  if (mode === 'DRY_RUN') {
    invariant(tables.size === manifest.fromTableCount || tables.size === manifest.toTableCount,
      'table inventory is neither the supported legacy nor target boundary');
    return { ...result, readyToApply: groups.length === 1 };
  }
  if (mode === 'ROLLBACK') return {
    ...result,
    actions: [{ kind: 'REDEPLOY_PREVIOUS_VERIFIED_BUNDLE', retainTables: true, retainRows: true }],
  };

  if (mode === 'APPLY') {
    invariant(confirmed === true, 'APPLY requires explicit confirmation');
    invariant(groups.length === 1, 'exactly one complete seven-run legacy group is required');
    if (!tables.has(manifest.newTable)) result.actions.push({ kind: 'CREATE_TABLE', table: manifest.newTable });
    const runColumns = tables.get('INT_AnalysisRun');
    for (const column of manifest.nullableRunColumns) {
      if (!runColumns.has(column)) result.actions.push({
        kind: 'ADD_NULLABLE_COLUMN', table: 'INT_AnalysisRun', column,
      });
    }
    const selected = groups[0];
    const alreadyBackfilled = manifest.nullableRunColumns.every(column => runColumns.has(column))
      && selected.runs.every(run => manifest.nullableRunColumns.every(column => run[column] !== null && run[column] !== undefined))
      && inventory.publicationState?.CurrentRunGroupID === selected.runGroupId;
    if (!alreadyBackfilled) {
      const generation = 1;
      const attemptSequence = 1;
      const backfilledRuns = [];
      for (const run of selected.runs) {
        const proven = inventory.provenRequestIdentities?.[run.BatchKey];
        const requestHash = SHA256.test(proven ?? '') ? proven : manifest.legacyUnknownRequestHash;
        const values = { RequestHash: requestHash, PublicationGeneration: generation, AttemptSequence: attemptSequence };
        backfilledRuns.push({ ...clone(run), ...values });
        result.actions.push({
          kind: 'BACKFILL_RUN', rowId: String(run.ROWID),
          values,
        });
      }
      const publishedAt = selected.runs[0].PublishedAt;
      result.actions.push({
        kind: 'UPSERT_PUBLICATION_POINTER',
        values: {
          PublicationStateID: 'CURRENT', PublicationGeneration: generation,
          CurrentRunGroupID: selected.runGroupId, CurrentRunsJSON: JSON.stringify(backfilledRuns),
          PointerVersion: 1, LastReservedAttemptSequence: attemptSequence,
          LatestAttemptSequence: attemptSequence, LatestAttemptStatus: 'COMPLETED',
          LatestAttemptRunGroupID: selected.runGroupId, PublishedAt: publishedAt,
          LatestAttemptAt: publishedAt, SyntheticData: true,
        },
      });
    }
    const unknownLegacyIdentityCount = result.actions
      .filter(action => action.kind === 'BACKFILL_RUN'
        && action.values.RequestHash === manifest.legacyUnknownRequestHash).length;
    return {
      ...result,
      state: {
        status: result.actions.length === 0 ? 'APPLIED' : 'APPLY_PLANNED',
        inventoryDigest: result.inventory.digest, unknownLegacyIdentityCount,
        activation: 'PENDING_VERIFICATION',
      },
    };
  }

  const requiredColumns = manifest.nullableRunColumns;
  const missingColumns = requiredColumns.filter(column => !tables.get('INT_AnalysisRun').has(column));
  const nullBackfillCount = (inventory.analysisRuns ?? []).filter(run => groups.some(group => group.runGroupId === run.RunGroupID))
    .reduce((count, run) => count + requiredColumns.filter(column => run[column] === null || run[column] === undefined).length, 0);
  const pointerValidation = verifyPointer({ manifest, inventory, groups, tables });
  const { pointerReady } = pointerValidation;
  const enforcementReady = missingColumns.length === 0 && nullBackfillCount === 0 && pointerReady;
  return {
    ...result,
    validation: {
      missingColumns, nullBackfillCount, ...pointerValidation,
      enforcementReady,
    },
    state: {
      status: enforcementReady ? 'VERIFIED' : 'VERIFY_FAILED',
      inventoryDigest: result.inventory.digest,
      deploymentBundle: enforcementReady ? 'PUBLICATION_POINTER' : 'PREVIOUS_VERIFIED',
    },
  };
}
