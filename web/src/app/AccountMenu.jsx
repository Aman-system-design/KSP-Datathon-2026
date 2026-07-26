import { useState } from 'react';
import { Icon } from '../components/icons.jsx';
import { roleLabel } from './workspace-labels.js';
import { getWorkspaceNavigation } from './workspace-navigation.js';

export function AccountMenu({ workspace, auth, onPersonaChange, triggerLabel }) {
  const [open, setOpen] = useState(false);
  const currentRoleLabel = roleLabel(workspace?.role);
  const identity = workspace?.identity ?? {};
  const unitLabel = workspace?.scopeUnit?.name?.trim()
    || (workspace?.role === 'STATION_OPERATIONS' ? 'Local station' : getWorkspaceNavigation(workspace).workspaceLabel);
  const choosePersona = persona => { setOpen(false); onPersonaChange(persona); };
  return <div className="account-menu">
    <button type="button" className="account-trigger" aria-expanded={open} aria-label={triggerLabel ?? `Account: ${currentRoleLabel}`} title={currentRoleLabel} onClick={() => setOpen(value => !value)}>
      <span>{currentRoleLabel.slice(0, 1) || 'U'}</span><Icon name="people" size={17} />
    </button>
    {open && <div className="account-popover">
      <div className="account-identity">
        <strong>{roleLabel(identity.actualRole) || currentRoleLabel}</strong>
        <small>{identity.employeeId ? `Employee ${identity.employeeId}` : 'Authenticated Catalyst user'}</small>
      </div>
      <div className="account-workspace"><small>Current workspace</small><strong>{currentRoleLabel}</strong><span>{unitLabel}</span></div>
      <div className="account-actions">
        <button type="button" onClick={() => choosePersona(null)}>Switch workspace</button>
        <button className="sign-out-action" type="button" onClick={() => auth.signOut()}>Sign out</button>
      </div>
    </div>}
  </div>;
}
