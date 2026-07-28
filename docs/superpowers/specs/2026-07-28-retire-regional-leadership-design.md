# Retire Regional Leadership Platform-Wide — Design

## Objective

Permanently retire `REGIONAL_LEADERSHIP` from the active KSP ACE platform so stale backend persona lists cannot crash Command Center and no user, URL, report, utility rule, or authorization policy can select or exercise the retired role.

## Observed Failure

Command Center receives `REGIONAL_LEADERSHIP` in `workspace.personaSwitch.personas`. The presentation catalogue intentionally returns `null` for that role, but `CommandCenterPersonaMenu` dereferences `presentation.label`. Opening the account menu therefore throws during React render and clears the application root.

## Retirement Semantics

- `REGIONAL_LEADERSHIP` is not remapped to District Leadership.
- Existing or stale Regional identities fail closed and receive no Regional authorization.
- Stale Regional values in persona-switch payloads are ignored by every presentation surface.
- A direct `?persona=REGIONAL_LEADERSHIP` request is not accepted as a demonstration persona.
- State Leadership, District Leadership, Crime Analyst, Station Operations, and Command Center remain unchanged.

## Active Code Changes

### Frontend

- Remove Regional Leadership from the runtime persona allowlist.
- Remove Regional workspace navigation and rendering branches.
- Remove Regional utility labels and role collections.
- Make Command Center persona rendering consume only non-null persona presentations so any future stale or unsupported role also fails safely.
- Keep the existing workspace-selector filtering behavior.

### Backend and Policy

- Remove Regional Leadership from the root access-policy role list and permission map.
- Remove it from disclosure, dashboard-management, and utility-rule role contracts.
- Apply identical changes to both Catalyst Function source mirrors:
  - `functions/crime_intelligence_api/app/`
  - `functions/intelligence_refresh/app/`
- Do not grant Regional permissions to another role.

### Documentation

- Update current README/product descriptions that still advertise District/Regional Leadership as an active persona.
- Preserve historical specs and plans because they document past decisions and are not runtime authority.

## Compatibility and Error Handling

Frontend persona collections filter unsupported roles before rendering. Backend policy rejects identities whose role is no longer present. This defense at both boundaries prevents a stale datastore row, cached session, or older Function response from restoring or crashing the retired persona.

## Testing

- Add a Command Center regression test that passes a persona list containing Regional Leadership, opens the account menu, and proves supported personas render while Regional does not.
- Update runtime tests to prove a direct Regional persona query is rejected.
- Update workspace-navigation and workspace rendering tests to remove Regional expectations.
- Update utility tests for the supported role catalogue.
- Update backend security, dashboard, disclosure, and utility-rule tests to prove Regional is absent or denied.
- Run focused frontend and backend suites, build the web client, and test the live Command Center account-menu switch after Development deployment.

## Deployment Isolation

- Implement in the existing isolated worktree.
- Commit only files changed for this retirement; preserve unrelated mirrored dashboard/persona work.
- Deploy the web client and affected Functions to Catalyst Development only after tests pass.
- Do not deploy Production or migrate Production data/configuration.

## Success Criteria

- Opening Command Center’s account menu never blanks the page.
- Regional Leadership is absent from every active persona selector and direct persona URL allowlist.
- Backend authorization and active contracts contain no Regional Leadership role.
- Supported persona switching works without a manual refresh.
- Development remains functional and Production remains untouched.
