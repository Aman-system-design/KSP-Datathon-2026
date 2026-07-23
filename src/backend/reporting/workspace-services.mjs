import { createAlertServices } from '../services/alert-services.mjs';
import { REPORT_SOURCES } from './semantic-sources.mjs';
import { createDashboardService } from './dashboard-service.mjs';
import { createReportService } from './report-service.mjs';

const envelope = data => ({ data, syntheticData: true });

export function createWorkspaceServices({ repository, readServices, mapViewService, now, idFactory }) {
  const reports = createReportService({ repository, readServices, mapViewService, now, idFactory: () => idFactory('REPORT') });
  const dashboards = createDashboardService({ repository, now, idFactory: () => idFactory('DASH') });
  const alerts = createAlertServices({ repository });

  const services = {
    async listReportSources() {
      return envelope(Object.values(REPORT_SOURCES).map(source => structuredClone(source)));
    },
    async listReports({ access }) { return envelope(await reports.list({ access })); },
    async createReport({ access, body, requestId }) { return envelope(await reports.create({ access, input: body, requestId })); },
    async getReport({ access, params }) { return envelope(await reports.get({ access, reportId: params.reportId })); },
    async updateReport({ access, params, body, requestId }) {
      return envelope(await reports.update({
        access, reportId: params.reportId, expectedVersion: body?.expectedVersion, input: body?.definition, requestId,
      }));
    },
    async deleteReport({ access, params }) { return envelope(await reports.remove({ access, reportId: params.reportId })); },
    async executeReport({ access, params, requestId }) {
      return envelope(await reports.execute({ access, reportId: params.reportId, requestId }));
    },

    async listDashboards({ access }) { return envelope(await dashboards.list({ access })); },
    async createDashboard({ access, body }) { return envelope(await dashboards.create({ access, input: body })); },
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
      const [landingDashboard, availableDashboards, availableReports, alertResult] = await Promise.all([
        dashboards.resolveLanding({ access }), dashboards.list({ access }), reports.list({ access }),
        alertPromise,
      ]);
      return envelope({
        role: access.role, scopeUnitId: access.scopeUnitId,
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
        semanticSources: Object.keys(REPORT_SOURCES),
        alertSummary: { total: alertResult.data.items.length }, syntheticData: true,
      });
    },
  };
  return Object.freeze(services);
}
