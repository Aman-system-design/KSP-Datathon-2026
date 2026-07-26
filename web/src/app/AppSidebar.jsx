import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { governedAppLocation } from './runtime.js';
import { titleCase } from './workspace-labels.js';
import { getWorkspaceNavigation } from './workspace-navigation.js';

export function AppSidebar({ workspace, collapsed = false, onCollapsedChange = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = getWorkspaceNavigation(workspace);
  const dashboards = workspace?.availableDashboards ?? [];
  const unitLabel = workspace?.scopeUnit?.name?.trim()
    || (workspace?.role === 'STATION_OPERATIONS' ? 'Local station' : navigation.workspaceLabel);
  return <>
    <nav className="module-rail" aria-label="Platform modules"><div className="module-links">
      {navigation.modules.map(item => <NavLink key={item.to} to={governedAppLocation(item.to, location)} end={item.to === '/'} aria-label={item.label} title={item.label}>
        <Icon name={item.icon} /><span>{item.label}</span>{item.to === '/alerts' && workspace?.alertSummary?.total > 0 && <b>{workspace.alertSummary.total}</b>}
      </NavLink>)}
    </div></nav>
    <aside className="context-sidebar">
      <button className="context-toggle" type="button" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} workspace panel`} onClick={() => onCollapsedChange(!collapsed)}>{collapsed ? '›' : '‹'}</button>
      {!collapsed && <nav aria-label="Workspace navigation">
        <span className="context-eyebrow">Current workspace</span><h2>{navigation.workspaceLabel}</h2>
        <div className="context-block"><small>Role</small><strong>{titleCase(workspace?.role)}</strong></div>
        <div className="context-block"><small>Geographic scope</small><strong>{unitLabel}</strong></div>
        <div className="context-divider" />
        <label className="dashboard-switcher">Active dashboard
          <select aria-label="Active dashboard" defaultValue={dashboards[0]?.id ?? ''} onChange={event => event.target.value && navigate(governedAppLocation(`/dashboards/${event.target.value}`, location))}>
            {dashboards.length === 0 && <option value="">Role workspace</option>}
            {dashboards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <NavLink className="context-alert-link" to={governedAppLocation('/alerts', location)}><span>Intelligence alerts</span><b>{workspace?.alertSummary?.total ?? 0}</b></NavLink>
      </nav>}
    </aside>
  </>;
}
