import { createHash } from 'node:crypto';

import { fail } from '../services/errors.mjs';
import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { isReportSourceAllowed } from './report-source-policy.mjs';

const hasAction = (access, action) => access?.actions?.includes(action);
const owns = (row, access) => row.ownerUserId === access?.actualUserId;
const defaultRoles = new Set([
  'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP',
  'CRIME_ANALYST', 'STATION_OPERATIONS', 'DEMO_PRESENTER', 'PLATFORM_ADMIN', 'AUDITOR',
]);
const STATION_DASHBOARD_NAME = 'Station Operations';
const STATION_BOOTSTRAP_PENDING = '[ACE:station-operations:v1:pending]';
const STATION_BOOTSTRAP_COMPLETE = '[ACE:station-operations:v1:complete]';
const bootstrapMarkers = new Set([STATION_BOOTSTRAP_PENDING, STATION_BOOTSTRAP_COMPLETE]);
const validLayout = ({ column, row, width, height } = {}) => [column, row, width, height].every(Number.isInteger)
  && column >= 1 && row >= 1 && width >= 1 && height >= 1 && column + width - 1 <= 12;
const idempotentId = (actor, key) => `DASH-IDEMP-${createHash('sha256')
  .update(canonicalStringify({ actor, key, resource: 'DASHBOARD' })).digest('hex').slice(0, 49)}`;

export function createDashboardService({ repository, now, idFactory }) {
  async function canViewReport(report, access) {
    if (!report) return false;
    if (!isReportSourceAllowed(access, report.definition?.sourceKey)) return false;
    if (owns(report, access) || report.visibility === 'GLOBAL') return true;
    const shares = await repository.listContentShares('REPORT', report.id);
    return shares.some(row => row.targetUserId === access.actualUserId || row.targetRole === access.role
      || (row.targetUnitId !== undefined && access.authorizedUnitIds?.has(row.targetUnitId)));
  }
  async function isDashboardAllowed(dashboard, access) {
    if (!dashboard) return false;
    if (access?.role !== 'STATION_OPERATIONS') return true;
    if (owns(dashboard, access)) return true;
    if (dashboard.defaultRole !== 'STATION_OPERATIONS') return false;
    const items = await repository.listDashboardItems(dashboard.id);
    for (const item of items) {
      if (!await canViewReport(await repository.getReport(item.reportId), access)) return false;
    }
    return true;
  }
  async function isStationDefaultCandidate(dashboard) {
    for (const item of await repository.listDashboardItems(dashboard.id)) {
      const report = await repository.getReport(item.reportId);
      if (!report || !isReportSourceAllowed({ role: 'STATION_OPERATIONS' }, report.definition?.sourceKey)) return false;
    }
    return true;
  }
  async function restoreRoleDefaultState(originals) {
    for (const original of originals.filter(Boolean)) {
      const current = await repository.getDashboard(original.id);
      if (!current) fail('DATA_NOT_READY');
      if (current.defaultRole !== original.defaultRole || current.visibility !== original.visibility) {
        const restored = await repository.updateDashboard(current.id, current.version, {
          defaultRole: original.defaultRole, visibility: original.visibility, updatedAt: now(),
        });
        if (!restored || restored.conflict) fail('DATA_NOT_READY');
      }
    }
    for (const original of originals.filter(Boolean)) {
      const restored = await repository.getDashboard(original.id);
      if (!restored || restored.defaultRole !== original.defaultRole || restored.visibility !== original.visibility) {
        fail('DATA_NOT_READY');
      }
    }
  }
  async function requireVisible(id, access) {
    const dashboard = await repository.getDashboard(id);
    if (!dashboard) fail('NOT_FOUND');
    if (!await isDashboardAllowed(dashboard, access)) fail('NOT_FOUND');
    if (access.role === 'STATION_OPERATIONS') return dashboard;
    if (owns(dashboard, access) || dashboard.visibility === 'GLOBAL' || dashboard.defaultRole === access.role) return dashboard;
    const shares = await repository.listContentShares('DASHBOARD', id);
    const shared = shares.some(row => row.targetUserId === access.actualUserId || row.targetRole === access.role
      || (row.targetUnitId !== undefined && access.authorizedUnitIds?.has(row.targetUnitId)));
    if (!shared) fail('NOT_FOUND');
    return dashboard;
  }
  async function requireOwner(id, access) {
    const dashboard = await repository.getDashboard(id);
    if (!dashboard) fail('NOT_FOUND');
    if (!owns(dashboard, access) && !hasAction(access, 'MANAGE_GLOBAL_CONTENT')) fail('FORBIDDEN_ACTION');
    return dashboard;
  }

  return Object.freeze({
    async create({ access, input, idempotencyKey }) {
      const name = String(input?.name ?? '').trim();
      if (!access?.actualUserId || !name || name.length > 128) fail('INVALID_REQUEST');
      const description = String(input.description ?? '').trim();
      if (bootstrapMarkers.has(description)
        && (access.role !== 'STATION_OPERATIONS' || description !== STATION_BOOTSTRAP_PENDING)) fail('INVALID_REQUEST');
      const timestamp = now();
      const key = typeof idempotencyKey === 'string' && idempotencyKey.trim() ? idempotencyKey.trim() : null;
      const id = key ? idempotentId(access.actualUserId, key) : idFactory();
      const intended = {
        id, ownerUserId: access.actualUserId, name,
        description, visibility: 'PRIVATE', version: 1,
        createdAt: timestamp, updatedAt: timestamp, syntheticData: true,
      };
      const replay = async () => {
        const existing = await repository.getDashboard(id);
        if (!existing || existing.ownerUserId !== intended.ownerUserId || existing.visibility !== 'PRIVATE'
          || existing.name !== intended.name || existing.description !== intended.description) return null;
        return existing;
      };
      if (key) {
        const existing = await replay();
        if (existing) return existing;
      }
      try { return await repository.createDashboard(intended); }
      catch (error) {
        if (!key) throw error;
        const existing = await replay();
        if (existing) return existing;
        fail('IDEMPOTENCY_CONFLICT');
      }
    },
    async get({ access, dashboardId }) {
      const dashboard = await requireVisible(dashboardId, access);
      const items = await repository.listDashboardItems(dashboardId);
      if (access.role !== 'STATION_OPERATIONS') return { ...dashboard, items };
      const allowedItems = [];
      for (const item of items) {
        if (await canViewReport(await repository.getReport(item.reportId), access)) allowedItems.push(item);
      }
      return { ...dashboard, items: allowedItems };
    },
    async list({ access }) {
      const dashboards = await repository.listDashboards();
      const visible = [];
      for (const dashboard of dashboards) {
        try {
          const authorized = await requireVisible(dashboard.id, access);
          const relationship = owns(authorized, access) ? 'OWNED'
            : authorized.visibility === 'GLOBAL' || authorized.defaultRole === access.role ? 'SYSTEM'
              : 'SHARED';
          visible.push({ ...authorized, relationship });
        } catch (error) {
          if (error.code !== 'NOT_FOUND') throw error;
        }
      }
      return visible;
    },
    async update({ access, dashboardId, expectedVersion, input }) {
      const current = await requireOwner(dashboardId, access);
      const name = String(input?.name ?? '').trim();
      if (!name || name.length > 128) fail('INVALID_REQUEST');
      const description = String(input.description ?? '').trim();
      if (current.description === STATION_BOOTSTRAP_PENDING) {
        if (access.role !== 'STATION_OPERATIONS' || description !== STATION_BOOTSTRAP_COMPLETE) fail('INVALID_REQUEST');
      } else if (current.description === STATION_BOOTSTRAP_COMPLETE) {
        if (description !== STATION_BOOTSTRAP_COMPLETE) fail('INVALID_REQUEST');
      } else if (bootstrapMarkers.has(description)) fail('INVALID_REQUEST');
      const updated = await repository.updateDashboard(dashboardId, expectedVersion, {
        name, description, updatedAt: now(),
      });
      if (updated?.conflict) fail('VERSION_CONFLICT');
      if (!updated) fail('NOT_FOUND');
      return updated;
    },
    async remove({ access, dashboardId }) {
      await requireOwner(dashboardId, access);
      await repository.deleteDashboard(dashboardId);
      return { deleted: true };
    },
    async addItem({ access, dashboardId, reportId, layout }) {
      await requireOwner(dashboardId, access);
      const report = await repository.getReport(reportId);
      if (!await canViewReport(report, access) || !validLayout(layout)) fail('INVALID_REQUEST');
      return repository.createDashboardItem({
        id: idFactory(), dashboardId, reportId, ...layout, version: 1, syntheticData: true,
      });
    },
    async replaceItems({ access, dashboardId, items }) {
      await requireOwner(dashboardId, access);
      if (!Array.isArray(items) || items.length > 24) fail('INVALID_REQUEST');
      const normalized = [];
      for (const [index, item] of items.entries()) {
        const report = await repository.getReport(item.reportId);
        if (!validLayout(item) || !await canViewReport(report, access)) fail('INVALID_REQUEST');
        normalized.push({
          id: idFactory(), dashboardId, reportId: item.reportId,
          column: item.column, row: item.row, width: item.width, height: item.height,
          displayOrder: index + 1, version: 1, syntheticData: true,
        });
      }
      return repository.replaceDashboardItems(dashboardId, normalized);
    },
    async share({ access, dashboardId, target, permission = 'VIEW' }) {
      await requireOwner(dashboardId, access);
      const values = [target?.userId, target?.role, target?.unitId].filter(value => value !== undefined);
      if (values.length !== 1 || permission !== 'VIEW') fail('INVALID_REQUEST');
      return repository.createContentShare({
        id: idFactory(), contentType: 'DASHBOARD', contentId: dashboardId,
        targetUserId: target.userId, targetRole: target.role, targetUnitId: target.unitId,
        permission, sharedByUserId: access.actualUserId, createdAt: now(), syntheticData: true,
      });
    },
    async setRoleDefault({ access, dashboardId, role }) {
      if (!hasAction(access, 'MANAGE_GLOBAL_CONTENT')) fail('FORBIDDEN_ACTION');
      if (!defaultRoles.has(role)) fail('INVALID_REQUEST');
      const dashboard = await repository.getDashboard(dashboardId);
      if (!dashboard) fail('NOT_FOUND');
      if (role === 'STATION_OPERATIONS' && !await isStationDefaultCandidate(dashboard)) fail('INVALID_REQUEST');
      const current = (await repository.listDashboards()).find(row => row.defaultRole === role && row.id !== dashboardId);
      try {
        if (current) {
          const unsetCurrent = await repository.updateDashboard(current.id, current.version, { defaultRole: undefined });
          if (!unsetCurrent || unsetCurrent.conflict) fail('VERSION_CONFLICT');
        }
        const updated = await repository.updateDashboard(dashboardId, dashboard.version, {
          defaultRole: role, visibility: 'GLOBAL', updatedAt: now(),
        });
        if (!updated || updated.conflict) fail('VERSION_CONFLICT');
        return updated;
      } catch (error) {
        await restoreRoleDefaultState([current, dashboard]);
        throw error;
      }
    },
    async setPersonalLanding({ access, dashboardId }) {
      await requireVisible(dashboardId, access);
      return repository.upsertUserPreference({
        id: `PREF-${access.actualUserId}`, userId: access.actualUserId,
        landingDashboardId: dashboardId, version: 1, updatedAt: now(), syntheticData: true,
      });
    },
    async resolveLanding({ access }) {
      const preference = await repository.getUserPreference(access.actualUserId);
      if (access.role === 'STATION_OPERATIONS') {
        const dashboards = await repository.listDashboards();
        if (preference?.landingDashboardId) {
          try {
            const personal = await requireVisible(preference.landingDashboardId, access);
            if (owns(personal, access)) return personal;
          } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
        }
        const roleDefault = dashboards.find(row => row.defaultRole === 'STATION_OPERATIONS');
        return roleDefault ? requireVisible(roleDefault.id, access) : undefined;
      }
      if (preference?.landingDashboardId) return requireVisible(preference.landingDashboardId, access);
      const roleDefault = (await repository.listDashboards()).find(row => row.defaultRole === access.role);
      if (roleDefault) return roleDefault;
      return undefined;
    },
    async cloneForOwner({ access, dashboardId, input = {} }) {
      const source = await requireVisible(dashboardId, access);
      if (access.role !== 'STATION_OPERATIONS') fail('FORBIDDEN_ACTION');
      const priorPreference = await repository.getUserPreference(access.actualUserId);
      const sourceItems = await repository.listDashboardItems(source.id);
      const validated = [];
      for (const [index, item] of sourceItems.entries()) {
        const report = await repository.getReport(item.reportId);
        if (!await canViewReport(report, access) || !validLayout(item)) fail('NOT_FOUND');
        validated.push({
          id: idFactory(), reportId: item.reportId,
          column: item.column, row: item.row, width: item.width, height: item.height,
          displayOrder: index + 1, version: 1, syntheticData: true,
        });
      }
      const timestamp = now();
      const created = await repository.createDashboard({
        id: idFactory(), ownerUserId: access.actualUserId,
        name: STATION_DASHBOARD_NAME, description: String(input.description ?? '').trim(),
        visibility: 'PRIVATE', version: 1, createdAt: timestamp, updatedAt: timestamp, syntheticData: true,
      });
      try {
        const items = validated.map(item => ({ ...item, dashboardId: created.id }));
        await repository.replaceDashboardItems(created.id, items);
        await repository.upsertUserPreference({
          id: `PREF-${access.actualUserId}`, userId: access.actualUserId,
          landingDashboardId: created.id, version: 1, updatedAt: timestamp, syntheticData: true,
        });
        const persistedPreference = await repository.getUserPreference(access.actualUserId);
        if (persistedPreference?.landingDashboardId !== created.id) fail('DATA_NOT_READY');
        return { ...created, relationship: 'OWNED', items };
      } catch (error) {
        try {
          if (priorPreference?.landingDashboardId) {
            await repository.upsertUserPreference({ ...priorPreference, updatedAt: now() });
          } else await repository.deleteUserPreference(access.actualUserId);
        } catch { /* dashboard cleanup below still removes clone-linked preferences */ }
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try { await repository.deleteDashboard(created.id); break; }
          catch { /* retry once, then preserve the original bounded failure */ }
        }
        fail('DATA_NOT_READY');
      }
    },
  });
}
