import { useState } from 'react';
import { Check, Maximize2, MoreHorizontal, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

export function CommandCenterWorkspaceToolbar({ dashboard, activeTab = 'overview', editing = false, saving = false, onTab = () => {}, onEdit = () => {}, onAdd = () => {}, onSave = () => {}, onCancel = () => {}, onPresent = () => {}, onDelete = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  if (!dashboard) return null;
  const tabs = dashboard.tabs ?? [];
  const active = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  const closeAfter = callback => () => { callback(); setMenuOpen(false); };
  return <header className="command-center-workspace-toolbar">
    <div className="command-center-workspace-title"><strong>{dashboard.name}</strong>{dashboard.defaultRole ? <span>Default</span> : null}</div>
    <div className="command-center-workspace-actions">
      <div className="command-center-toolbar-menu">
        <button type="button" aria-label="Dashboard options" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><MoreHorizontal aria-hidden="true" /></button>
        {menuOpen ? <div role="menu" aria-label="Dashboard tabs" className="command-center-toolbar-menu__popover">
          <span>Dashboard view</span>
          {tabs.map(tab => <button role="menuitem" type="button" key={tab.id} onClick={closeAfter(() => onTab(tab.id))}>{tab.id === active?.id ? <Check aria-hidden="true" /> : <i />}{tab.name}</button>)}
          <hr />
          {editing ? <>
            <button role="menuitem" type="button" onClick={closeAfter(onAdd)}><Plus aria-hidden="true" />Add chart</button>
            <button role="menuitem" type="button" onClick={closeAfter(onCancel)}><X aria-hidden="true" />Cancel editing</button>
            <button role="menuitem" type="button" disabled={saving} onClick={closeAfter(onSave)}><Save aria-hidden="true" />{saving ? 'Saving…' : 'Save dashboard'}</button>
          </> : <button role="menuitem" type="button" onClick={closeAfter(onEdit)}><Pencil aria-hidden="true" />Edit dashboard</button>}
          <button role="menuitem" type="button" onClick={closeAfter(onPresent)}><Maximize2 aria-hidden="true" />Present dashboard</button>
          <button role="menuitem" type="button" onClick={closeAfter(onDelete)}><Trash2 aria-hidden="true" />Delete dashboard</button>
        </div> : null}
      </div>
    </div>
  </header>;
}
