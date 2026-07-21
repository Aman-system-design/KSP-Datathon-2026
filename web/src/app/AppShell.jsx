import { NavLink, useNavigate } from 'react-router-dom';

const titleCase = value => String(value ?? '').toLowerCase().split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const navigation = [
  ['/', 'Command workspace'], ['/intelligence', 'Crime intelligence'], ['/maps', 'Hotspot map'],
  ['/reports', 'Reports'], ['/dashboards', 'Dashboards'], ['/networks', 'Link analysis'],
];

export function AppShell({ workspace, children }) {
  const dashboards = workspace?.availableDashboards ?? [];
  const navigate = useNavigate();
  return <div className="app-shell">
    <header className="topbar" role="banner">
      <div className="brand-mark" aria-hidden="true">KSP</div>
      <div className="brand-copy">
        <strong>Karnataka Police Intelligence</strong>
        <span>Decision intelligence platform</span>
      </div>
      <label className="dashboard-switcher">Dashboard
        <select aria-label="Active dashboard" defaultValue={dashboards[0]?.id ?? ''} onChange={event => event.target.value && navigate(`/dashboards/${event.target.value}`)}>
          {dashboards.length === 0 && <option value="">Role workspace</option>}
          {dashboards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <NavLink className="alert-button" to="/alerts">Alerts <b>{workspace?.alertSummary?.total ?? 0}</b></NavLink>
      <div className="user-context">
        <strong>{titleCase(workspace?.role)}</strong>
        <span>Unit {workspace?.scopeUnitId ?? '—'}</span>
      </div>
    </header>
    <aside className="sidebar">
      <nav aria-label="Primary navigation">
        {navigation.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
      </nav>
      <div className="scope-card"><span>Authorized scope</span><strong>Unit {workspace?.scopeUnitId ?? '—'}</strong></div>
    </aside>
    <main className="workspace-main">{children}</main>
    {workspace?.syntheticData && <footer className="data-banner">Synthetic demonstration data · No operational policing decision</footer>}
  </div>;
}
