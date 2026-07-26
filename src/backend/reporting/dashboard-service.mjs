import { fail } from '../services/errors.mjs';
import { isReportSourceAllowed } from './report-source-policy.mjs';

const hasAction = (access, action) => access?.actions?.includes(action);
const owns = (row, access) => row.ownerUserId === access?.actualUserId;
const defaultRoles = new Set([
  'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP',
  'CRIME_ANALYST', 'STATION_OPERATIONS', 'DEMO_PRESENTER', 'PLATFORM_ADMIN', 'AUDITOR',
]);
const STATION_DASHBOARD_NAME = 'Station Operations';
const validLayout = ({ column, row, width, height } = {}) => [column, row, width, height].every(Number.isInteger)
  && column >= 1 && row >= 1 && width >= 1 && height >= 1 && column + width - 1 <= 12;

export function createDashboardService({ repository, now, idFactory }) {
  async function canViewReport(report, access) {
    if (!report) return false;
    if (!isReportSourceAllowed(access, report.definition?.sourceKey)) return false;
    if (owns(report, access) || report.visibility === 'GLOBAL') return true;
    const shares = await repository.listContentShares('REPORT', report.id);
    return shares.some(row => row.targetUserId === access.actualUserId || row.targetRole === access.role
      || (row.targetUnitId !== undefined && access.authorizedUnitIds?.has(row.targetUnitId)));
  }
  async function requireVisible(id, access) {
    const dashboard = await repository.getDashboard(id);
    if (!dashboard) fail('NOT_FOUND');
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
    async create({ access, input }) {
      const name = String(input?.name ?? '').trim();
      if (!access?.actualUserId || !name || name.length > 128) fail('INVALID_REQUEST');
      const timestamp = now();
      return repository.createDashboard({
        id: idFactory(), ownerUserId: access.actualUserId, name,
        description: String(input.description ?? '').trim(), visibility: 'PRIVATE', version: 1,
        createdAt: timestamp, updatedAt: timestamp, syntheticData: true,
      });
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
      await requireOwner(dashboardId, access);
      const name = String(input?.name ?? '').trim();
      if (!name || name.length > 128) fail('INVALID_REQUEST');
      const updated = await repository.updateDashboard(dashboardId, expectedVersion, {
        name, description: String(input.description ?? '').trim(), updatedAt: now(),
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
      const current = (await repository.listDashboards()).find(row => row.defaultRole === role && row.id !== dashboardId);
      if (current) await repository.updateDashboard(current.id, current.version, { defaultRole: undefined });
      const updated = await repository.updateDashboard(dashboardId, dashboard.version, {
        defaultRole: role, visibility: 'GLOBAL', updatedAt: now(),
      });
      if (updated?.conflict) fail('VERSION_CONFLICT');
      return updated;
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
        const roleDefault = dashboards.find(row => row.defaultRole === 'STATION_OPERATIONS');
        if (roleDefault) return roleDefault;
        if (!preference?.landingDashboardId) return undefined;
        const personal = await requireVisible(preference.landingDashboardId, access);
        return owns(personal, access) && personal.name === STATION_DASHBOARD_NAME ? personal : undefined;
      }
      if (preference?.landingDashboardId) return requireVisible(preference.landingDashboardId, access);
      const roleDefault = (await repository.listDashboards()).find(row => row.defaultRole === access.role);
      if (roleDefault) return roleDefault;
      return undefined;
    },
  });
}
