import { LogOut } from 'lucide-react';

export function PersonaAccountMenu({ open, triggerLabel, initial = 'U', currentLabel = '', personas = [], onToggle, onSelect, onAllWorkspaces, onSignOut }) {
  return <div className="account-menu">
    <button type="button" className="account-trigger" data-animate-icon="user" aria-expanded={open} aria-label={triggerLabel} onClick={onToggle}>
      <span>{initial}</span>
    </button>
    {open ? <div className="account-popover" role="menu" aria-label="Change persona">
      <div className="account-identity"><strong>KSP Intelligence</strong>{currentLabel ? <small>Viewing as {currentLabel}</small> : null}</div>
      {personas.length > 0 ? <div className="persona-switch" role="group" aria-label="Switch demonstration persona">
        <span>Workspaces</span>
        {personas.map(persona => <button type="button" role="menuitem" key={persona.value} aria-pressed={persona.current} onClick={() => onSelect(persona.value)}>{persona.label}</button>)}
      </div> : null}
      {onAllWorkspaces ? <button className="presenter-return" type="button" role="menuitem" onClick={onAllWorkspaces}>All workspaces</button> : null}
      <button className="sign-out-action" type="button" role="menuitem" onClick={onSignOut}><LogOut aria-hidden="true" />Sign out</button>
    </div> : null}
  </div>;
}
