import { useState } from 'react';
import { Icon } from '../components/icons.jsx';
import { roleLabel, titleCase } from './workspace-labels.js';

export function AccountMenu({ workspace, auth, onPersonaChange }) {
  const [open, setOpen] = useState(false);
  const currentRoleLabel = roleLabel(workspace?.role);
  const identity = workspace?.identity ?? {};
  const personaSwitch = workspace?.personaSwitch ?? { allowed: false, personas: [] };
  const unitLabel = workspace?.scopeUnitId ? `Unit ${workspace.scopeUnitId}` : 'Configured scope';
  const choosePersona = persona => { setOpen(false); onPersonaChange(persona); };
  return <div className="account-menu">
    <button type="button" className="account-trigger" aria-expanded={open} aria-label={`Account: ${currentRoleLabel}`} onClick={() => setOpen(value => !value)}>
      <span>{currentRoleLabel.slice(0, 1) || 'U'}</span><Icon name="people" size={17} />
    </button>
    {open && <div className="account-popover">
      <div className="account-identity">
        <strong>{roleLabel(identity.actualRole) || currentRoleLabel}</strong>
        <small>{identity.employeeId ? `Employee ${identity.employeeId}` : 'Authenticated Catalyst user'}</small>
        {identity.demoPersona && <span>Viewing as {currentRoleLabel}</span>}
        <small>{unitLabel}</small>
        {workspace?.syntheticData && <small>Data provenance: demonstration dataset</small>}
      </div>
      {personaSwitch.allowed === true && <div className="persona-switch" role="group" aria-label="Switch demonstration persona">
        <span>Demonstration persona</span>
        {personaSwitch.personas.map(persona => <button type="button" key={persona} aria-pressed={workspace.role === persona} onClick={() => choosePersona(persona)}>{titleCase(persona)}</button>)}
        <button type="button" className="presenter-return" onClick={() => choosePersona(null)}>Return to KSP Intelligence</button>
      </div>}
      <button className="sign-out-action" type="button" onClick={() => auth.signOut()}>Sign out</button>
    </div>}
  </div>;
}
