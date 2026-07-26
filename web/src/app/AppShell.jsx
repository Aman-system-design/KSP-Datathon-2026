import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { catalystAuth } from '../auth/catalyst-auth.js';
import { AppSidebar } from './AppSidebar.jsx';
import { PlatformHeader } from './PlatformHeader.jsx';
import { personaSearch } from './runtime.js';

export function AppShell({ workspace, auth = catalystAuth, children }) {
  const [contextCollapsed, setContextCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const switchPersona = persona => navigate({
    pathname: '/',
    search: personaSearch(location.search, persona),
  });

  const stationWorkspace = workspace?.role === 'STATION_OPERATIONS';
  return <div className={`app-shell${stationWorkspace ? ' app-shell--station' : ''}${contextCollapsed ? ' context-collapsed' : ''}`}>
    <PlatformHeader workspace={workspace} auth={auth} onPersonaChange={switchPersona} />
    <AppSidebar workspace={workspace} collapsed={contextCollapsed} onCollapsedChange={setContextCollapsed} />
    <main className="workspace-main">{children}</main>
  </div>;
}
