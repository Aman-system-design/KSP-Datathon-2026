import { PERSONA_DASHBOARD_TEMPLATES } from './persona-dashboard-templates.js';
import { provisionDashboardTemplate } from './provision-dashboard-template.js';

export const templatesForWorkspace = workspace => PERSONA_DASHBOARD_TEMPLATES
  .filter(template => template.roles.includes(workspace?.role));

export async function provisionPersonaDashboards({ api, workspace }) {
  const warnings = [];
  for (const template of templatesForWorkspace(workspace)) {
    try { await provisionDashboardTemplate({ api, template }); }
    catch (error) { warnings.push({ key: template.key, error }); }
  }
  try {
    const refreshed = (await api.get('/v1/workspace')).data;
    return { workspace: refreshed, warnings };
  } catch (error) {
    return { workspace, warnings: [...warnings, { key: 'workspace-refresh', error }] };
  }
}
