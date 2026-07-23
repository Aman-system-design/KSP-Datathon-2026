# Authenticated Workspace Bootstrap Design

**Status:** Ready for founder review

**Target:** `https://aiksp.onslate.in`

## Outcome

Deliver one dependable live journey before expanding the analytics experience:

1. unauthenticated visitor sees the Karnataka State Police branded Catalyst sign-in;
2. Catalyst verifies the user and establishes the session;
3. the application loads `/v1/workspace` using the Catalyst authentication token;
4. a Development demo-presenter sees only the personas returned by the backend;
5. selecting a persona causes the backend to resolve that role and jurisdiction;
6. the user enters the shared platform shell and the selected role home.

This release does not freeze the State Leadership information design. The current leadership mockup is provisional because the final design must support 31 districts and lakhs of FIRs without rendering all records in the browser.

## Authentication

- Use Catalyst Embedded Authentication version 4 with CSS customization enabled.
- Load `catalystWebSDK.js` and `/__catalyst/sdk/init.js` from the deployed Slate site.
- Render the real Catalyst form through `catalyst.auth.signIn`; do not recreate credential fields in React.
- Use invitation-only access. The application does not provide public registration.
- Use the supplied Karnataka State Police emblem without recolouring or distortion.
- The sign-in screen follows the approved split layout derived from the official shadcn `login-02` block: KSP identity on the left, the embedded Catalyst form on the right.
- Roboto is served from the application bundle. Kannada-compatible system fallbacks remain configured.
- Authentication failure stays on the sign-in experience with Catalyst's real error. It never opens a demonstration workspace.

## Workspace Resolution and Persona Selection

- After authentication, call the existing governed `GET /v1/workspace` endpoint.
- The backend is authoritative for identity, role, unit scope, synthetic-data provenance and `personaSwitch.personas`.
- A normal user bypasses persona selection and enters the role mapped by the backend.
- A Development demo-presenter receives the approved workspace selector only when `personaSwitch.allowed` is true.
- The selector renders only personas in `personaSwitch.personas`.
- Selecting a persona sends it through the existing `X-Demo-Persona` request contract and reloads `/v1/workspace`.
- A query parameter can preserve the jury walkthrough route, but it never grants access. Unsupported personas fail closed.
- The chosen persona remains available from the profile menu during the Development walkthrough. Production removes both the selector and switcher when Microsoft Entra mapping replaces the demo-presenter flow.

## UI System

- Use the official shadcn block composition as the implementation foundation:
  - `login-02` for the split sign-in structure;
  - `sidebar-01` for grouped, collapsible navigation;
  - `dashboard-01` for the role-home shell, cards, tables, badges and profile menu.
- Initialize shadcn in the existing Vite application only after reviewing the generated configuration and file diff.
- Prefer shadcn source components and semantic design tokens. Avoid one-off card, badge, button, dropdown and sidebar implementations.
- The palette remains Catalyst-like: white surfaces, light grey boundaries, restrained KSP blue actions, and limited red/yellow/green identity accents.
- Global header content is limited to sidebar control, breadcrumb or current page, notifications/help where functional, and the authenticated profile menu.
- Do not show environment, freshness or data-mode blocks globally. Relevant freshness and provenance belong beside the affected result.
- The shell must remain usable at desktop, tablet and mobile widths and must meet keyboard-focus and accessible-name requirements.

## Role Shell

- All roles share the same shell and authorization boundary.
- Navigation is derived from the resolved workspace, not hard-coded by browser persona.
- The sidebar collapses to icons and preserves the active module.
- Profile menu contains identity, current role, persona switching only when backend-authorized, and sign out.
- Every role home is independently replaceable without changing authentication or navigation.
- The provisional State Leadership home may be deployed for live review, but it must use API values only. Missing values render an unavailable state, never zero or an invented number.

## Statewide Scale Boundary

The later State Leadership design will aggregate server-side by authorized time window, district, station, crime classification and workflow status. It will return bounded summaries and paginated drilldowns. The browser will not download lakhs of FIR rows to compute statewide cards or charts.

The target information hierarchy is:

- statewide movement and comparison;
- priority intelligence with evidence and confidence;
- 31-district exception ranking rather than 31 equal cards;
- drilldown from state to district to station to FIR;
- server-side pagination, filtering and aggregation;
- asynchronous model-run and map-layer execution for expensive analytics.

## Failure Behaviour

- Missing Catalyst SDK: show a specific authentication-service-unavailable state.
- Missing session or token: return to sign-in without exposing protected navigation.
- Function unreachable: show a retryable workspace-connectivity state with request ID.
- Access profile missing: show access-not-provisioned; do not show a persona picker.
- Persona rejected: remain on the selector and show an authorization error.
- Role home API partially fails: keep the shell and successful sections usable; mark only the failed section unavailable.
- Never substitute hard-coded success data after identity, transport, authorization or analytics failure.

## Testing and Live Acceptance

1. Unit tests cover authentication states, token generation, persona allowlisting, persona rejection, sign out and role routing.
2. Component tests cover keyboard navigation, visible focus, avatar fallback, collapsible sidebar and profile-menu semantics.
3. API contract tests prove `X-Demo-Persona` is server-validated and production workspaces expose no selector.
4. The production build emits no source maps and contains no credentials or private keys.
5. Deploy to Slate and verify in a fresh browser at `https://aiksp.onslate.in`:
   - KSP-branded Catalyst sign-in renders;
   - a confirmed invited user can sign in;
   - the authorized persona selector appears only for the demo presenter;
   - each permitted persona resolves a real `/v1/workspace` response;
   - the selected role shell loads without console errors;
   - sign out returns to the authentication screen.

## Out of Scope for This Bootstrap Release

- final 31-district State Leadership analytics design;
- Microsoft Entra integration;
- new QuickML model deployment;
- additional external live feeds;
- replacing the governed synthetic competition fixture with KSP production data.

