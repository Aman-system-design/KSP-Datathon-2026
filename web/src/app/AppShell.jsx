import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { catalystAuth } from '../auth/catalyst-auth.js';
import { Icon } from '../components/icons.jsx';
import { OrganizationBrand } from '../components/OrganizationBrand.jsx';
import { personaSearch } from './runtime.js';
import { getWorkspaceNavigation } from './workspace-navigation.js';

const titleCase = value => String(value ?? '').toLowerCase().split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export function AppShell({ workspace, auth = catalystAuth, children }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const dashboards = workspace?.availableDashboards ?? [];
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = getWorkspaceNavigation(workspace);
  const roleLabel = titleCase(workspace?.role);
  const identity = workspace?.identity ?? {};
  const personaSwitch = workspace?.personaSwitch ?? { allowed: false, personas: [] };
  const actualRoleLabel = titleCase(identity.actualRole);
  const unitLabel = workspace?.scopeUnitId ? `Unit ${workspace.scopeUnitId}` : 'Configured scope';
  const switchPersona = persona => {
    setAccountOpen(false);
    navigate({ pathname: '/', search: personaSearch(location.search, persona) });
  };

  return <div className={`app-shell${contextCollapsed ? ' context-collapsed' : ''}`}>
    <header className="topbar" role="banner">
      <div className="platform-identity">
        <OrganizationBrand compact />
        <span><strong>KSP Crime Decision Intelligence</strong><small>Karnataka State Police</small></span>
      </div>
      <div className="global-search">
        <Icon name="intelligence" size={17} />
        <input type="search" aria-label="Global search" placeholder="Search is available after governed indexing" disabled />
      </div>
      <div className="header-context" aria-label="Current operational context">
        <span><small>Authorized scope</small><strong>{unitLabel}</strong></span>
        <span className="freshness-status"><small>Intelligence freshness</small><strong>{workspace?.freshness ?? 'Latest verified run'}</strong></span>
        {workspace?.syntheticData && <span className="data-provenance"><small>Data mode</small><strong>Demonstration</strong></span>}
      </div>
      <NavLink className="header-alert" to="/alerts" aria-label="Alerts">
        <Icon name="alerts" />
      </NavLink>
      <div className="account-menu">
        <button type="button" className="account-trigger" aria-expanded={accountOpen} aria-label={`Account: ${roleLabel}`} onClick={() => setAccountOpen(value => !value)}>
          <span>{roleLabel.slice(0, 1) || 'U'}</span><Icon name="people" size={17} />
        </button>
        {accountOpen && <div className="account-popover">
          <div className="account-identity">
            <strong>{actualRoleLabel || roleLabel}</strong>
            <small>{identity.employeeId ? `Employee ${identity.employeeId}` : 'Authenticated Catalyst user'}</small>
            {identity.demoPersona && <span>Viewing as {roleLabel}</span>}
            <small>{unitLabel}</small>
            {workspace?.syntheticData && <small>Data provenance: demonstration dataset</small>}
          </div>
          {personaSwitch.allowed === true && <div className="persona-switch" role="group" aria-label="Switch demonstration persona">
            <span>Demonstration persona</span>
            {personaSwitch.personas.map(persona => <button
              type="button" key={persona} aria-pressed={workspace.role === persona}
              onClick={() => switchPersona(persona)}
            >{titleCase(persona)}</button>)}
            <button type="button" className="presenter-return" onClick={() => switchPersona(null)}>Return to presenter</button>
          </div>}
          <button className="sign-out-action" type="button" onClick={() => auth.signOut()}>Sign out</button>
        </div>}
      </div>
    </header>

    <nav className="module-rail" aria-label="Platform modules">
      <div className="module-links">
        {navigation.modules.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} aria-label={item.label} title={item.label}>
          <Icon name={item.icon} /><span>{item.label}</span>
          {item.to === '/alerts' && workspace?.alertSummary?.total > 0 && <b>{workspace.alertSummary.total}</b>}
        </NavLink>)}
      </div>
    </nav>

    <aside className="context-sidebar">
      <button className="context-toggle" type="button" aria-label={`${contextCollapsed ? 'Expand' : 'Collapse'} workspace panel`} onClick={() => setContextCollapsed(value => !value)}>{contextCollapsed ? '›' : '‹'}</button>
      {!contextCollapsed && <nav aria-label="Workspace navigation">
        <span className="context-eyebrow">Current workspace</span>
        <h2>{navigation.workspaceLabel}</h2>
        <div className="context-block"><small>Role</small><strong>{roleLabel}</strong></div>
        <div className="context-block"><small>Geographic scope</small><strong>{unitLabel}</strong></div>
        <div className="context-divider" />
        <label className="dashboard-switcher">Active dashboard
          <select aria-label="Active dashboard" defaultValue={dashboards[0]?.id ?? ''} onChange={event => event.target.value && navigate(`/dashboards/${event.target.value}`)}>
            {dashboards.length === 0 && <option value="">Role workspace</option>}
            {dashboards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <NavLink className="context-alert-link" to="/alerts"><span>Intelligence alerts</span><b>{workspace?.alertSummary?.total ?? 0}</b></NavLink>
      </nav>}
    </aside>

    <main className="workspace-main">{children}</main>
  </div>;
}
