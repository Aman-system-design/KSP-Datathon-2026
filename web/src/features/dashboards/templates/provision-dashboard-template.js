const list = response => Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

const matchingReport = (reports, definition) => reports.find(report => report?.relationship === 'OWNED'
  && canonical(report.definition) === canonical(definition));
const matchingDashboard = (dashboards, template, description) => dashboards.find(dashboard =>
  dashboard?.relationship === 'OWNED' && dashboard?.name === template.name && dashboard?.description === description);
const create = (api, path, body, key) => typeof api.idempotent === 'function'
  ? api.idempotent(path, body, key) : api.post(path, body);
const replace = (api, path, body, key) => typeof api.idempotentPut === 'function'
  ? api.idempotentPut(path, body, key) : api.put(path, body);

const inFlight = new WeakMap();

export function provisionDashboardTemplate(input) {
  let operations = inFlight.get(input.api);
  if (!operations) { operations = new Map(); inFlight.set(input.api, operations); }
  const running = operations.get(input.template.key);
  if (running) return running;
  const operation = performProvision(input).finally(() => operations.delete(input.template.key));
  operations.set(input.template.key, operation);
  return operation;
}

async function performProvision({ api, template }) {
  let reports = list(await api.get('/v1/reports'));
  let dashboards = list(await api.get('/v1/dashboards'));
  const completed = matchingDashboard(dashboards, template, template.description);
  if (completed) return { dashboard: completed, reports };

  const templateReports = [];
  for (const [index, definition] of template.reports.entries()) {
    let persisted = matchingReport(reports, definition);
    if (!persisted) {
      try { persisted = (await create(api, '/v1/reports', definition, `${template.key}/report/${index}`)).data; }
      catch (error) {
        reports = list(await api.get('/v1/reports'));
        persisted = matchingReport(reports, definition);
        if (!persisted) throw error;
      }
      persisted = { ...persisted, relationship: 'OWNED' };
      reports = [...reports.filter(value => value.id !== persisted.id), persisted];
    }
    templateReports.push(persisted);
  }

  let dashboard = matchingDashboard(dashboards, template, template.pendingDescription);
  if (!dashboard) {
    try {
      dashboard = (await create(api, '/v1/dashboards', {
        name: template.name, description: template.pendingDescription,
      }, `${template.key}/dashboard`)).data;
    } catch (error) {
      dashboards = list(await api.get('/v1/dashboards'));
      dashboard = matchingDashboard(dashboards, template, template.pendingDescription)
        ?? matchingDashboard(dashboards, template, template.description);
      if (!dashboard) throw error;
    }
    dashboard = { ...dashboard, relationship: 'OWNED' };
  }
  if (dashboard.description === template.description) return { dashboard, reports };

  const items = template.layout.map((placement, index) => ({ reportId: templateReports[index].id, ...placement }));
  await replace(api, `/v1/dashboards/${encodeURIComponent(dashboard.id)}/items`, { items }, `${template.key}/dashboard-items`);
  dashboard = (await api.patch(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`, {
    expectedVersion: dashboard.version,
    name: template.name,
    description: template.description,
  })).data;
  return { dashboard: { ...dashboard, relationship: 'OWNED', items }, reports };
}
