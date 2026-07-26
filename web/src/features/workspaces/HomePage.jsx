import { lazy, Suspense } from 'react';

import { Busy } from '../../app/AsyncStates.jsx';
import { PersonaDirectory } from '../admin/PersonaDirectory.jsx';
import { IntelligenceWorkspacePage } from '../intelligence/IntelligenceWorkspacePage.jsx';
import { PersonaWorkspace } from './PersonaWorkspace.jsx';

const StateLeadershipDashboard = lazy(() => import('../intelligence/StateLeadershipDashboard.jsx')
  .then(module => ({ default: module.StateLeadershipDashboard })));

export function HomePage({ api, workspace }) {
  if (workspace.role === 'DEMO_PRESENTER') return <PersonaDirectory role={workspace.role} />;
  if (['PLATFORM_ADMIN', 'AUDITOR'].includes(workspace.role)) return <PersonaWorkspace role={workspace.role} data={{}} />;
  if (workspace.role === 'STATE_LEADERSHIP') return <Suspense fallback={<Busy label="Loading State Leadership dashboard…" />}><StateLeadershipDashboard api={api} workspace={workspace} /></Suspense>;
  return <IntelligenceWorkspacePage api={api} role={workspace.role} />;
}
