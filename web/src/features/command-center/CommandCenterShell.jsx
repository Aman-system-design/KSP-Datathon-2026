import { useState } from 'react';
import { CommandCenterHeader } from './CommandCenterHeader.jsx';
import { CommandCenterRail } from './CommandCenterRail.jsx';
import { CommandCenterDashboardWorkspace } from './CommandCenterDashboardWorkspace.jsx';
import { CommandCenterDashboardLibrary } from './CommandCenterDashboardLibrary.jsx';
import { COMMAND_CENTER_APPEARANCE_KEY, readCommandCenterAppearance, resolveCommandCenterAppearance } from './command-center-appearance.js';

export function CommandCenterShell({ api, workspace, personas = [], view = 'canvas', createMode = false, requestedDashboardId = null, onPersonaSelect = () => {}, onAllWorkspaces = () => {}, onModuleNavigate = () => {}, onOpenAllDashboards = () => {}, onCreateDashboard = () => {}, onOpenDashboard = () => {}, onDashboardCreated = () => {}, onCancelCreate = () => {}, onDashboardDeleted = () => {} }) {
  const [selected, setSelected] = useState('home');
  const [appearance, setAppearance] = useState(readCommandCenterAppearance);
  const [openMenu, setOpenMenu] = useState(null);
  const [dashboardsOpen, setDashboardsOpen] = useState(false);
  const resolved = resolveCommandCenterAppearance(appearance);
  const changeAppearance = value => {
    localStorage.setItem(COMMAND_CENTER_APPEARANCE_KEY, value);
    setAppearance(value);
    setOpenMenu(null);
  };
  const selectPersona = role => { onPersonaSelect(role); setOpenMenu(null); };
  const showAllWorkspaces = () => { onAllWorkspaces(); setOpenMenu(null); };
  const selectModule = id => {
    setSelected(id);
    if (id !== 'home' && id !== 'dashboards') onModuleNavigate(id);
  };
  return <div className={`command-center-shell command-center-shell--${resolved}`} data-appearance={resolved} role="application" aria-label="KSP Command Center">
    <CommandCenterHeader appearance={appearance} personas={personas} accountOpen={openMenu === 'account'} settingsOpen={openMenu === 'settings'} onAccountToggle={() => setOpenMenu(current => current === 'account' ? null : 'account')} onSettingsToggle={() => setOpenMenu(current => current === 'settings' ? null : 'settings')} onAppearanceChange={changeAppearance} onPersonaSelect={selectPersona} onAllWorkspaces={showAllWorkspaces} />
    <CommandCenterRail selected={selected} onSelect={selectModule} onDashboardOpen={() => setDashboardsOpen(true)} />
    {api && workspace ? view === 'library'
      ? <CommandCenterDashboardLibrary api={api} dashboards={workspace.availableDashboards ?? []} createMode={createMode} onOpen={onOpenDashboard} onCreateMode={onCreateDashboard} onCreated={onDashboardCreated} onCancelCreate={onCancelCreate} />
      : <CommandCenterDashboardWorkspace api={api} workspace={workspace} requestedDashboardId={requestedDashboardId} pickerOpen={dashboardsOpen} onPickerClose={() => setDashboardsOpen(false)} onOpenAll={onOpenAllDashboards} onCreate={onCreateDashboard} onDeleted={onDashboardDeleted} />
      : <main className="command-center-canvas" data-testid="command-center-canvas" />}
  </div>;
}
