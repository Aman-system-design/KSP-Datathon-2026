import { useState } from 'react';
import { Icon } from '../components/icons.jsx';
import { titleCase } from './workspace-labels.js';

export function AccountMenu({ workspace, auth, onPersonaChange }) {
  const [open, setOpen] = useState(false);
  const roleLabel = titleCase(workspace?.role);
  const identity = workspace?.identity ?? {};
  const personaSwitch = workspace?.personaSwitch ?? { allowed: false, personas: [] };
  const unitLabel = workspace?.scopeUnitId ? `Unit ${workspace.scopeUnitId}` : 'Configured scope';
  const choosePersona = persona => { setOpen(false); onPersonaChange(persona); };
  return <div className="account-menu">
    <button type="button" className="account-trigger" aria-expanded={open} aria-label={`Account: ${roleLabel}`} onClick={() => setOpen(value => !value)}>
      <span>{roleLabel.slice(0, 1) || 'U'}</span><Icon name="people" size={17} />
    </button>
    {open && <div className="account-popover">
      <div className="account-identity">
        <strong>{titleCase(identity.actualRole) || roleLabel}</strong>
        <small>{identity.employeeId ? `Employee ${identity.employeeId}` : 'Authenticated Catalyst user'}</small>
        {identity.demoPersona && <span>Viewing as {roleLabel}</span>}
        <small>{unitLabel}</small>
        {workspace?.syntheticData && <small>Data provenance: demonstration dataset</small>}
      </div>
      {personaSwitch.allowed === true && <div className="persona-switch" role="group" aria-label="Switch demonstration persona">
        <span>Demonstration persona</span>
        {personaSwitch.personas.map(persona => <button type="button" key={persona} aria-pressed={workspace.role === persona} onClick={() => choosePersona(persona)}>{titleCase(persona)}</button>)}
        <button type="button" className="presenter-return" onClick={() => choosePersona(null)}>Return to presenter</button>
      </div>}
      <button className="sign-out-action" type="button" onClick={() => auth.signOut()}>Sign out</button>
    </div>}
  </div>;
}
