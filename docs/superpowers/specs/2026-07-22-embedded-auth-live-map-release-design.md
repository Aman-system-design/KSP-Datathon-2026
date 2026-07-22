# Embedded Authentication and Live Map Release — Approved Delta

**Status:** Founder approved on July 22, 2026

**Extends:** `2026-07-21-catalyst-persona-ui-design.md` and `2026-07-22-geospatial-studio-design.md`

## Outcome

`https://aiksp.onslate.in` must be a working Catalyst Development release, not a permissive demo bypass. An unauthenticated visitor sees Catalyst Embedded Authentication. After sign-in, the server resolves the Catalyst user, access profile, role, jurisdiction and permitted persona-switch capability. No `LOADING` role or empty authorized-workspace fallback may enter the application shell.

The Geospatial Studio opens over Karnataka with useful operational intelligence already visible. Its hotspot, anomaly and area-risk features must come from the Catalyst API and published analytical results; the frontend must not contain demonstration coordinates or fabricated intelligence.

## Selected Approach

Use Catalyst Embedded Authentication v4.6.2 on the Slate origin and same-project relative Function routing.

- Load `https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js` and `/__catalyst/sdk/init.js`.
- Render `catalyst.auth.signIn("loginDivElementId", config)` only in the unauthenticated gate.
- Keep Catalyst default login styling because CSS customization is disabled.
- Set `service_url` to `/` so a successful sign-in returns to the application.
- Call the Function through `/server/crime_intelligence_api`; do not derive authentication from the cross-origin Development Function host or call `generateAuthToken` for this Slate deployment.
- Continue to enforce access profiles, role permissions and unit scope in the Function. A signed-in user without a valid profile receives the governed access-not-provisioned state.

Rejected alternatives are a public synthetic identity bypass and a hosted-login redirect. The bypass weakens the real access path; the redirect does not satisfy the requested embedded experience.

## Application States

1. **Bootstrapping:** load the Catalyst initialization script and check the session.
2. **Unauthenticated:** show the KSP identity and the Catalyst embedded login form.
3. **Authenticated but unprovisioned:** show the safe access-not-provisioned state and request ID.
4. **Authorized:** render the role-specific shell and routes returned by `/v1/workspace`.
5. **Failure:** show a retryable safe error. Never substitute a `LOADING` role, empty workspace, invented metrics or demo data.

The profile menu remains the Development-only persona switch surface for an authorized `DEMO_PRESENTER`. Every persona selection is re-authorized by the backend.

## Default Geospatial Experience

- Default viewport: Karnataka bounds, not `[0, 0]`.
- After the authorized dataset catalogue loads, automatically add the available `hotspots`, `anomalies` and `areaRisk` datasets once, in that order.
- Execute each layer through `/v1/geospatial/layers/execute` using the existing governed layer contract.
- Preserve user control: layers can be hidden, reordered, configured or removed; saved views replace the default composition when opened.
- Retain MapLibre, deck.gl, H3, PMTiles, OpenFreeMap and Supercluster.
- Keep the evidence drawer, freshness state and accessible feature table. A failed analytical layer must not remove the basemap or other successful layers.
- Do not copy WorldMonitor code or external feeds. Its useful pattern is the immediately informative, layer-driven operational canvas.

## Error and Security Rules

- Authentication failure never falls through into the application shell.
- Missing workspace data is an error, not a default persona.
- The client never supplies organization or geographic authority.
- No source record, secret, token, stack or SDK detail is shown in UI errors.
- Analytics and map outputs retain method/run, freshness, confidence, evidence and limitation metadata.
- The release remains Catalyst Development and synthetic-only until a separately reviewed production deployment exists.

## Test and Release Gates

Automated tests must first fail and then prove:

- the embedded login invokes Catalyst `signIn` with the correct container and `/` service URL;
- authenticated Slate operation uses the relative Function route without `generateAuthToken`;
- missing workspace data renders an error and never `role: LOADING`;
- normal and demo-presenter persona authorization remains unchanged;
- Karnataka is the initial viewport;
- the three available default intelligence datasets are added once and execute through the API;
- unavailable datasets, empty results and layer failures remain honest and isolated.

Release acceptance additionally requires:

1. full backend and frontend tests pass;
2. production frontend build passes without source maps;
3. local browser login-gate and map behavior pass without framework errors;
4. Catalyst Function and Slate deployments succeed;
5. a fresh browser session at `https://aiksp.onslate.in` shows embedded login;
6. an authenticated session resolves a real workspace and opens the populated Karnataka map;
7. browser console has no relevant authentication, application or map errors.

No completion claim is permitted before step 7.
