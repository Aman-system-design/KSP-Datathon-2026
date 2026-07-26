import { fail } from '../services/errors.mjs';
import { getReportSource } from './semantic-sources.mjs';
import { normalizeReportDefinition } from './report-definition.mjs';
import { executeReportDefinition, projectMapReportExecution, projectReportRows } from './report-execution.mjs';

const hasAction = (access, action) => access?.actions?.includes(action);
const owns = (row, access) => row.ownerUserId === access?.actualUserId;
const matchesShare = (share, access) => share.targetUserId === access.actualUserId
  || share.targetRole === access.role
  || (share.targetUnitId !== undefined && access.authorizedUnitIds?.has(share.targetUnitId));
const clientReport = report => Object.freeze({
  id: report.id, name: report.name, visibility: report.visibility,
  version: report.version, definition: structuredClone(report.definition),
});

function normalizedReport(input) {
  try { return normalizeReportDefinition(input, getReportSource(input?.sourceKey)); }
  catch (error) {
    if (error?.code) throw error;
    fail('INVALID_REQUEST');
  }
}

export function createReportService({ repository, readServices, mapViewService, now, idFactory }) {
  async function visible(report, access) {
    if (!report) return false;
    if (owns(report, access) || report.visibility === 'GLOBAL') return true;
    const shares = await repository.listContentShares('REPORT', report.id);
    return shares.some((share) => matchesShare(share, access));
  }
  async function requireVisible(reportId, access) {
    const report = await repository.getReport(reportId);
    if (!await visible(report, access)) fail('NOT_FOUND');
    return report;
  }
  async function requireOwner(reportId, access) {
    const report = await repository.getReport(reportId);
    if (!report) fail('NOT_FOUND');
    if (!owns(report, access) && !hasAction(access, 'MANAGE_GLOBAL_CONTENT')) fail('FORBIDDEN_ACTION');
    return report;
  }
  async function authorizeMapReference(definition, access, requestId) {
    if (definition.visualization.type !== 'map') return;
    if (typeof mapViewService?.getMapView !== 'function') fail('DATA_NOT_READY');
    const governed = await mapViewService.getMapView({
      access, params: { mapViewId: definition.visualization.mapViewId }, requestId,
    });
    if (governed?.data?.id !== definition.visualization.mapViewId) fail('DATA_NOT_READY');
  }

  return Object.freeze({
    async create({ access, input, requestId }) {
      if (!access?.actualUserId) fail('FORBIDDEN_ACTION');
      const definition = normalizedReport(input);
      await authorizeMapReference(definition, access, requestId);
      const timestamp = now();
      return repository.createReport({
        id: idFactory(), ownerUserId: access.actualUserId, visibility: 'PRIVATE', version: 1,
        definition: structuredClone(definition), name: definition.name, createdAt: timestamp,
        updatedAt: timestamp, syntheticData: true,
      });
    },
    async get({ access, reportId }) { return requireVisible(reportId, access); },
    async list({ access }) {
      const reports = await repository.listReports();
      const result = [];
      for (const report of reports) if (await visible(report, access)) result.push(report);
      return result;
    },
    async update({ access, reportId, expectedVersion, input, requestId }) {
      await requireOwner(reportId, access);
      const definition = normalizedReport(input);
      await authorizeMapReference(definition, access, requestId);
      const updated = await repository.updateReport(reportId, expectedVersion, {
        definition: structuredClone(definition), name: definition.name, updatedAt: now(),
      });
      if (updated?.conflict) fail('VERSION_CONFLICT');
      if (!updated) fail('NOT_FOUND');
      return updated;
    },
    async execute({ access, reportId, requestId }) {
      const report = await requireVisible(reportId, access);
      if (report.definition.visualization.type === 'map') {
        if (typeof mapViewService?.getMapView !== 'function') fail('DATA_NOT_READY');
        const governed = await mapViewService.getMapView({
          access, params: { mapViewId: report.definition.visualization.mapViewId }, requestId,
        });
        return {
          definition: clientReport(report),
          result: { data: projectMapReportExecution(governed.data), meta: governed.meta },
        };
      }
      const source = getReportSource(report.definition.sourceKey);
      const service = readServices[source.service];
      if (typeof service !== 'function') fail('DATA_NOT_READY');
      const result = await service({ access, query: { limit: Math.min(report.definition.limit, 200) } });
      return {
        definition: clientReport(report),
        syntheticData: result.syntheticData === true,
        ...(result.provenance ? { provenance: result.provenance } : {}),
        result: {
          data: { items: executeReportDefinition(report.definition, projectReportRows(source.key, result)) },
          meta: result.meta,
        },
      };
    },
    async share({ access, reportId, target, permission = 'VIEW' }) {
      await requireOwner(reportId, access);
      const values = [target?.userId, target?.role, target?.unitId].filter(value => value !== undefined);
      if (values.length !== 1 || permission !== 'VIEW') fail('INVALID_REQUEST');
      return repository.createContentShare({
        id: idFactory(), contentType: 'REPORT', contentId: reportId,
        targetUserId: target.userId, targetRole: target.role, targetUnitId: target.unitId,
        permission, sharedByUserId: access.actualUserId, createdAt: now(), syntheticData: true,
      });
    },
    async publishGlobal({ access, reportId }) {
      if (!hasAction(access, 'MANAGE_GLOBAL_CONTENT')) fail('FORBIDDEN_ACTION');
      const report = await repository.getReport(reportId);
      if (!report) fail('NOT_FOUND');
      const updated = await repository.updateReport(reportId, report.version, { visibility: 'GLOBAL', updatedAt: now() });
      if (updated?.conflict) fail('VERSION_CONFLICT');
      return updated;
    },
    async remove({ access, reportId }) {
      await requireOwner(reportId, access);
      if (await repository.isReportReferenced(reportId)) fail('RESOURCE_IN_USE');
      await repository.deleteReport(reportId);
      return { deleted: true };
    },
  });
}
