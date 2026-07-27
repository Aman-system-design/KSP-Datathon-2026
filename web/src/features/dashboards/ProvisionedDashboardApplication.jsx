import { useEffect, useMemo, useState } from 'react';

import { Busy } from '../../app/AsyncStates.jsx';
import { provisionPersonaDashboards, templatesForWorkspace } from './templates/provision-persona-dashboards.js';

export function missingDashboardTemplates(workspace) {
  const dashboards = workspace?.availableDashboards ?? [];
  return templatesForWorkspace(workspace).filter(template => !dashboards.some(dashboard =>
    dashboard.name === template.name && dashboard.description === template.description));
}

export function ProvisionedDashboardApplication({ api, workspace, children }) {
  const missing = useMemo(() => missingDashboardTemplates(workspace), [workspace]);
  const [state, setState] = useState(() => ({ loading: missing.length > 0, workspace }));

  useEffect(() => {
    let active = true;
    if (missing.length === 0) { setState({ loading: false, workspace }); return undefined; }
    setState({ loading: true, workspace });
    provisionPersonaDashboards({ api, workspace }).then(result => {
      if (active) setState({ loading: false, workspace: result.workspace, warnings: result.warnings });
    });
    return () => { active = false; };
  }, [api, workspace?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.loading) return <main className="application-gate"><Busy branded label="Preparing governed dashboardâ€¦" /></main>;
  return <>
    {state.warnings?.length > 0 ? <div className="dashboard-setup-warning" role="alert">
      <strong>Dashboard setup incomplete</strong>
      {state.warnings.map(warning => <span key={warning.key}>
        {warning.key} · {warning.error?.code ?? 'SETUP_FAILED'}
      </span>)}
    </div> : null}
    {children(state.workspace ?? workspace)}
  </>;
}
