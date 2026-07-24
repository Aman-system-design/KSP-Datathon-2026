import { getPersonaPresentation } from '../../app/workspace-navigation.js';

export function CommandCenterPersonaMenu({ personas, onSelect, onAllWorkspaces }) {
  return <div className="command-center-menu command-center-persona-menu" role="menu" aria-label="Change persona">
    <strong>Change persona</strong>
    {personas.map(role => {
      const presentation = getPersonaPresentation(role);
      return <button key={role} type="button" role="menuitem" onClick={() => onSelect(role)}>{presentation.label}</button>;
    })}
    <button type="button" role="menuitem" onClick={onAllWorkspaces}>All workspaces</button>
  </div>;
}
