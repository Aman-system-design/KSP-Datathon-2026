import { useState } from 'react';
import { ChevronDown, Maximize2 } from 'lucide-react';

export function CommandCenterWorkspaceToolbar({ dashboard, activeTab = 'overview', editing = false, saving = false, onTab = () => {}, onEdit = () => {}, onSave = () => {}, onCancel = () => {}, onPresent = () => {} }) {
  const [tabsOpen, setTabsOpen] = useState(false);
  const tabs = dashboard?.tabs ?? [];
  const active = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  return <header className="command-center-workspace-toolbar">
    <div className="command-center-workspace-title"><strong>{dashboard?.name ?? 'Command Centre'}</strong>{dashboard?.defaultRole ? <span>Default</span> : null}</div>
    <div className="command-center-workspace-actions">
      <div className="command-center-tab-control"><button type="button" disabled={!dashboard} aria-label={`${active?.name ?? 'Overview'} dashboard tab`} aria-expanded={tabsOpen} onClick={() => setTabsOpen(open => !open)}>{active?.name ?? 'Overview'}<ChevronDown aria-hidden="true" /></button>{tabsOpen ? <div role="menu" aria-label="Dashboard tabs">{tabs.map(tab => <button role="menuitem" type="button" key={tab.id} onClick={() => { onTab(tab.id); setTabsOpen(false); }}>{tab.name}</button>)}</div> : null}</div>
      {editing ? <><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="button" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</button></> : <button type="button" disabled={!dashboard} onClick={onEdit}>Edit dashboard</button>}
      <button type="button" disabled={!dashboard} onClick={onPresent}><Maximize2 aria-hidden="true" />Present</button>
    </div>
  </header>;
}
