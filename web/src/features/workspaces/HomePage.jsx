import { PersonaDirectory } from '../admin/PersonaDirectory.jsx';
import { IntelligenceWorkspacePage } from '../intelligence/IntelligenceWorkspacePage.jsx';
import { PersonaWorkspace } from './PersonaWorkspace.jsx';

export function HomePage({ api, workspace }) {
  if (workspace.role === 'DEMO_PRESENTER') return <PersonaDirectory role={workspace.role} />;
  if (['PLATFORM_ADMIN', 'AUDITOR'].includes(workspace.role)) return <PersonaWorkspace role={workspace.role} data={{}} />;
  return <IntelligenceWorkspacePage api={api} role={workspace.role} />;
}
