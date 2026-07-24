import { useState } from 'react';
import { CommandCenterHeader } from './CommandCenterHeader.jsx';
import { CommandCenterRail } from './CommandCenterRail.jsx';
import { CommandCenterDashboardWorkspace } from './CommandCenterDashboardWorkspace.jsx';
import { COMMAND_CENTER_APPEARANCE_KEY, readCommandCenterAppearance, resolveCommandCenterAppearance } from './command-center-appearance.js';

export function CommandCenterShell({ api, workspace, personas = [], onPersonaSelect = () => {}, onAllWorkspaces = () => {}, onOpenAllDashboards = () => {} }) {
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
  return <div className={`command-center-shell command-center-shell--${resolved}`} data-appearance={resolved} role="application" aria-label="KSP Command Center">
    <CommandCenterHeader appearance={appearance} personas={personas} accountOpen={openMenu === 'account'} settingsOpen={openMenu === 'settings'} onAccountToggle={() => setOpenMenu(current => current === 'account' ? null : 'account')} onSettingsToggle={() => setOpenMenu(current => current === 'settings' ? null : 'settings')} onAppearanceChange={changeAppearance} onPersonaSelect={selectPersona} onAllWorkspaces={showAllWorkspaces} />
    <CommandCenterRail selected={selected} onSelect={setSelected} onDashboardOpen={() => setDashboardsOpen(true)} />
    {api && workspace ? <CommandCenterDashboardWorkspace api={api} workspace={workspace} pickerOpen={dashboardsOpen} onPickerClose={() => setDashboardsOpen(false)} onOpenAll={onOpenAllDashboards} /> : <main className="command-center-canvas" data-testid="command-center-canvas" />}
  </div>;
}
