# KSP Intelligence Label and Workspace Selector Design

## Decision

Rename the user-facing `Demo Presenter` persona to `KSP Intelligence` across the application while retaining `DEMO_PRESENTER` as the internal authorization key.

Make the workspace selector fit ordinary desktop viewports without its own scrollbar, and present Command Centre with the same neutral icon treatment as every other workspace.

## Scope

- Replace visible `Demo Presenter` and `demo presenter` wording with `KSP Intelligence` or context-appropriate neutral wording.
- Keep `DEMO_PRESENTER` unchanged in access policies, Catalyst `CFG_UserAccess`, API authorization, routes, tests that assert internal role values, and audit records.
- Update UI tests to assert the new display label without weakening authorization coverage.
- Remove the Command Centre-only visual class; selection state alone distinguishes the active card.
- Use compact height-aware spacing for short desktop viewports. Allow document scrolling only when responsive layouts genuinely require it.

## Rationale

The internal key already protects Development-only persona switching and is stored in Catalyst. Changing it would require a coordinated data, policy, backend, frontend, and deployment migration without improving the user experience. Separating the display label from the stable role key delivers the requested product terminology with minimal operational risk.

## Verification

- Frontend tests confirm `KSP Intelligence` is displayed in the workspace selector and account surfaces.
- Backend security tests confirm `DEMO_PRESENTER` authorization behavior remains unchanged.
- Production build succeeds before deployment.
- Browser verification confirms the selector footer is visible and the panel does not scroll internally at the target desktop viewport.
