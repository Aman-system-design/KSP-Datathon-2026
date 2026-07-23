import { Link } from 'react-router-dom';

import { WorkspaceHeader } from '../../components/PlatformPrimitives.jsx';
import { personaWorkspaceDefinitions } from '../../app/workspace-navigation.js';

export function PersonaDirectory({ role }) {
  if (!['PLATFORM_ADMIN', 'DEMO_PRESENTER'].includes(role)) return <section className="feature-page"><WorkspaceHeader eyebrow="Authorization" title="Workspace not authorized" description="This directory is restricted to platform governance and KSP Intelligence." /></section>;
  const canOpen = role === 'DEMO_PRESENTER';
  return <section className="feature-page">
    <WorkspaceHeader eyebrow="Administration" title="Persona Workspaces" description="Monitor the configured role experiences without creating a second authorization system." />
    {!canOpen && <div className="partial-state">A KSP Intelligence account is required to open another persona. Platform administrators retain their own non-evidence role.</div>}
    <div className="persona-directory">{personaWorkspaceDefinitions.map(item => <article className="panel" key={item.role}>
      <div><span className="eyebrow">{item.scope}</span><h2>{item.label}</h2><p>{item.workspace}</p></div>
      <dl><dt>Role key</dt><dd>{item.role}</dd><dt>Default experience</dt><dd>{item.workspace}</dd></dl>
      {canOpen ? <Link className="secondary-button" to={item.route}>Open workspace</Link> : <span className="status-badge">Monitored configuration</span>}
    </article>)}</div>
  </section>;
}
