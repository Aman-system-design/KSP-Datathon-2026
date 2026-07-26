import { createAlertServices } from '../services/alert-services.mjs';
import { fail } from '../services/errors.mjs';
import { REPORT_SOURCES } from './semantic-sources.mjs';
import { createDashboardService } from './dashboard-service.mjs';
import { createReportService } from './report-service.mjs';
import { visibleReportSources } from './report-source-policy.mjs';

const envelope = data => ({ data, syntheticData: true });
const header = (headers, name) => Object.entries(headers ?? {})
  .find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];

export function createWorkspaceServices({ repository, readServices, mapViewService, caseService, now, idFactory }) {
  const reports = createReportService({ repository, readServices, mapViewService, now, idFactory: () => idFactory('REPORT') });
  const dashboards = createDashboardService({ repository, now, idFactory: () => idFactory('DASH') });
  const alerts = createAlertServices({ repository });

  const services = {
    async listStationCases({ access, query }) {
      if (typeof caseService?.list !== 'function') fail('DATA_NOT_READY');
      return caseService.list({ access, query });
    },
    async getStationCase({ access, params }) {
      if (typeof caseService?.get !== 'function') fail('DATA_NOT_READY');
      return caseService.get({ access, caseId: params.caseId });
    },
    async listReportSources({ access } = {}) {
      return envelope(visibleReportSources(access, Object.values(REPORT_SOURCES)).map(source => structuredClone(source)));
    },
    async listReports({ access }) { return envelope(await reports.list({ access })); },
    async createReport({ access, body, headers, requestId }) {
      return envelope(await reports.create({
        access, input: body, requestId, idempotencyKey: header(headers, 'Idempotency-Key'),
      }));
    },
    async getReport({ access, params }) { return envelope(await reports.get({ access, reportId: params.reportId })); },
    async updateReport({ access, params, body, requestId }) {
      return envelope(await reports.update({
        access, reportId: params.reportId, expectedVersion: body?.expectedVersion, input: body?.definition, requestId,
      }));
    },
    async deleteReport({ access, params }) { return envelope(await reports.remove({ access, reportId: params.reportId })); },
    async executeReport({ access, params, body, requestId }) {
      return envelope(await reports.execute({
        access, reportId: params.reportId, requestId, runtimeFilters: body?.runtimeFilters,
      }));
    },

    async listDashboards({ access }) { return envelope(await dashboards.list({ access })); },
    async createDashboard({ access, body, headers }) {
      return envelope(await dashboards.create({
        access, input: body, idempotencyKey: header(headers, 'Idempotency-Key'),
      }));
    },
    async getDashboard({ access, params }) { return envelope(await dashboards.get({ access, dashboardId: params.dashboardId })); },
    async updateDashboard({ access, params, body }) {
      return envelope(await dashboards.update({
        access, dashboardId: params.dashboardId, expectedVersion: body?.expectedVersion, input: body,
      }));
    },
    async deleteDashboard({ access, params }) { return envelope(await dashboards.remove({ access, dashboardId: params.dashboardId })); },
    async replaceDashboardItems({ access, params, body }) {
      return envelope(await dashboards.replaceItems({ access, dashboardId: params.dashboardId, items: body?.items }));
    },
    async cloneDashboard({ access, params, body }) {
      return envelope(await dashboards.cloneForOwner({ access, dashboardId: params.dashboardId, input: body }));
    },
    async shareDashboard({ access, params, body }) {
      return envelope(await dashboards.share({
        access, dashboardId: params.dashboardId, target: body?.target, permission: body?.permission,
      }));
    },
    async setRoleDefault({ access, params, body }) {
      return envelope(await dashboards.setRoleDefault({ access, dashboardId: params.dashboardId, role: body?.role }));
    },
    async setLandingDashboard({ access, body }) {
      return envelope(await dashboards.setPersonalLanding({ access, dashboardId: body?.dashboardId }));
    },
    async listAlerts(input) { return alerts.listAlerts(input); },
    async getAlertDetail(input) { return alerts.getAlertDetail(input); },
    async getWorkspace({ access }) {
      const alertPromise = access.actions?.includes('READ_ALERT')
        ? alerts.listAlerts({ access, query: {} })
        : Promise.resolve({ data: { items: [] } });
      const [landingResult, dashboardsResult, reportsResult, alertsResult, unitsResult] = await Promise.allSettled([
        dashboards.resolveLanding({ access }), dashboards.list({ access }), reports.list({ access }),
        alertPromise, repository.getUnits(),
      ]);
      const landingDashboard = landingResult.status === 'fulfilled' ? landingResult.value : undefined;
      const allDashboards = dashboardsResult.status === 'fulfilled' ? dashboardsResult.value : [];
      const availableDashboards = access.role === 'STATION_OPERATIONS'
        ? allDashboards.filter(row => row.defaultRole === 'STATION_OPERATIONS'
          || row.relationship === 'OWNED')
        : allDashboards;
      const availableReports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];
      const semanticSources = visibleReportSources(access, Object.values(REPORT_SOURCES)).map(source => source.key);
      const alertResult = alertsResult.status === 'fulfilled' ? alertsResult.value : { data: { items: [] } };
      const scopedUnit = unitsResult.status === 'fulfilled'
        ? unitsResult.value.find(unit => Number(unit.UnitID) === Number(access.scopeUnitId)) : undefined;
      const unitTypes = new Map([[1, 'State headquarters'], [2, 'District'], [3, 'Police station']]);
      return envelope({
        role: access.role, scopeUnitId: access.scopeUnitId,
        ...(scopedUnit ? { scopeUnit: {
          name: scopedUnit.UnitName,
          type: unitTypes.get(Number(scopedUnit.TypeID)) ?? 'Police unit',
        } } : {}),
        identity: {
          employeeId: access.employeeId,
          actualRole: access.actualRole,
          effectiveRole: access.role,
          demoPersona: access.demoPersona,
        },
        personaSwitch: {
          allowed: access.personaSwitchAllowed,
          personas: [...(access.availablePersonas ?? [])],
        },
        landingDashboard, availableDashboards, availableReports,
        semanticSources,
        alertSummary: { total: alertResult.data.items.length }, syntheticData: true,
      });
    },
  };
  return Object.freeze(services);
}
