import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getPersonaPresentation } from '../app/workspace-navigation.js';

function authorizedPersonas(workspace) {
  if (workspace?.personaSwitch?.allowed !== true) return [];
  return (workspace.personaSwitch.personas ?? []).filter(role => typeof role === 'string');
}

export function WorkspaceSelector({ workspace, onSelect, onSignOut }) {
  const personas = authorizedPersonas(workspace);
  const [selectedRole, setSelectedRole] = useState('');

  if (personas.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/40 p-6">
        <Card className="w-full max-w-lg" role="alert">
          <CardHeader>
            <CardTitle>No demonstration workspace is authorized</CardTitle>
            <CardDescription>Your authenticated profile has no available persona workspaces.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={onSignOut}>Sign out</Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="workspace-entry">
      <header className="workspace-entry__brand">
        <img src="/brand/karnataka-state-police.webp" alt="Karnataka State Police emblem" />
        <div><strong>Karnataka State Police</strong><span>Crime Decision Intelligence</span></div>
        <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
      </header>
      <section className="workspace-entry__panel">
        <header>
          <span>Authorized access</span>
          <h1>Select workspace</h1>
          <p>Choose the operational view required for this session.</p>
        </header>
        <div className="workspace-entry__list" role="radiogroup" aria-label="Authorized workspaces">
            {personas.map(role => {
              const presentation = getPersonaPresentation(role);
              const selected = selectedRole === role;
              return (
                <button
                  type="button"
                  key={role}
                  role="radio"
                  aria-checked={selected}
                  aria-label={presentation.label}
                  className={selected ? 'selected' : ''}
                  onClick={() => setSelectedRole(role)}
                >
                  <span className="workspace-entry__radio" aria-hidden="true" />
                  <span><strong>{presentation.label}</strong><small>{presentation.workspace}</small></span>
                  <span className="workspace-entry__scope">{presentation.scope}</span>
                </button>
              );
            })}
        </div>
        <footer><span>Signed in as <strong>Demo Presenter</strong></span><Button disabled={!selectedRole} onClick={() => onSelect(selectedRole)}>Continue</Button></footer>
      </section>
    </main>
  );
}
