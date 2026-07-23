import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '../components/icons.jsx';
import { commandCentreWorkspace, getPersonaPresentation } from '../app/workspace-navigation.js';
import { roleLabel } from '../app/workspace-labels.js';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';

function authorizedPersonas(workspace) {
  if (workspace?.personaSwitch?.allowed !== true) return [];
  return (workspace.personaSwitch.personas ?? []).filter(role => typeof role === 'string');
}

function authorizedWorkspaces(workspace) {
  const personas = authorizedPersonas(workspace).map(role => ({
    ...getPersonaPresentation(role),
    destination: Object.freeze({ type: 'persona', role }),
  }));
  return workspace?.role === 'DEMO_PRESENTER' ? [commandCentreWorkspace, ...personas] : personas;
}

export function WorkspaceSelector({ workspace, onSelect, onSignOut }) {
  const brand = usePlatformBrand();
  const workspaces = authorizedWorkspaces(workspace);
  const [selectedKey, setSelectedKey] = useState('');

  if (workspaces.length === 0) {
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
        <img src={brand.primaryLogo} alt={`${brand.organizationName} emblem`} />
        <div><strong>{brand.organizationName}</strong>{brand.showProductTagline && <span>{brand.productTagline}</span>}</div>
        <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
      </header>
      <section className="workspace-entry__panel">
        <header>
          <span>Authorized access</span>
          <h1>Select workspace</h1>
          <p>Choose the operational view required for this session.</p>
        </header>
        <div className="workspace-entry__list" role="radiogroup" aria-label="Authorized workspaces">
            {workspaces.map(presentation => {
              const selected = selectedKey === presentation.role;
              return (
                <button
                  type="button"
                  key={presentation.role}
                  role="radio"
                  aria-checked={selected}
                  aria-label={presentation.label}
                  className={selected ? 'selected' : ''}
                  onClick={() => setSelectedKey(presentation.role)}
                >
                  <span className="workspace-entry__icon"><Icon name={presentation.icon} size={22} /></span>
                  <span className="workspace-entry__copy"><strong>{presentation.label}</strong><small>{presentation.workspace}</small></span>
                  <span className="workspace-entry__scope">{presentation.scope}</span>
                  <span className="workspace-entry__radio" aria-hidden="true" />
                </button>
              );
            })}
        </div>
        <footer><span>Signed in as <strong>{roleLabel(workspace.role)}</strong></span><Button disabled={!selectedKey} onClick={() => onSelect(workspaces.find(item => item.role === selectedKey)?.destination)}>Continue</Button></footer>
      </section>
    </main>
  );
}
