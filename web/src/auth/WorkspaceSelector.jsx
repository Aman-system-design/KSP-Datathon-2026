import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
    <main className="min-h-screen bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-xl border bg-background shadow-sm lg:grid-cols-[0.8fr_1.2fr]">
        <section className="flex flex-col justify-between bg-primary p-8 text-primary-foreground sm:p-12">
          <div>
            <img className="mb-8 h-24 w-24 object-contain" src="/brand/karnataka-state-police.webp" alt="Karnataka State Police emblem" />
            <p className="text-sm font-medium opacity-80">Karnataka State Police</p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">Crime Decision Intelligence Platform</h1>
            <p className="mt-4 max-w-md text-sm leading-6 opacity-80">Open a governed workspace to review crime intelligence within its authorized operational scope.</p>
          </div>
          <p className="mt-12 text-xs opacity-70">Authenticated through Catalyst</p>
        </section>

        <section className="flex flex-col p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Signed in</p>
              <p className="font-medium">Demo Presenter</p>
            </div>
            <Avatar>
              <AvatarImage src="/brand/ksp-logo.webp" alt="Karnataka State Police" />
              <AvatarFallback>DP</AvatarFallback>
            </Avatar>
          </div>
          <Separator className="my-6" />
          <div>
            <Badge variant="secondary">Authorized personas</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Choose a workspace</h2>
            <p className="mt-2 text-sm text-muted-foreground">This selection changes the demonstration view. The backend still validates every role and data scope.</p>
          </div>

          <ToggleGroup
            className="mt-7 grid w-full gap-3 sm:grid-cols-2"
            type="single"
            value={selectedRole}
            onValueChange={value => value && setSelectedRole(value)}
            aria-label="Authorized workspaces"
          >
            {personas.map(role => {
              const presentation = getPersonaPresentation(role);
              const selected = selectedRole === role;
              return (
                <ToggleGroupItem
                  key={role}
                  value={role}
                  variant="outline"
                  role="radio"
                  aria-checked={selected}
                  aria-label={presentation.label}
                  className="h-auto min-h-28 w-full items-start justify-start rounded-lg p-4 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-primary/5"
                >
                  <span>
                    <span className="block font-semibold">{presentation.label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{presentation.workspace}</span>
                    <span className="mt-3 block text-xs text-muted-foreground">{presentation.scope}</span>
                  </span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          <div className="mt-auto flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
            <Button disabled={!selectedRole} onClick={() => onSelect(selectedRole)}>Open workspace</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
