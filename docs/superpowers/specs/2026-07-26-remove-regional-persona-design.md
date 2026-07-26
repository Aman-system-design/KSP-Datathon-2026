# Remove Regional Leadership Persona — Design

## Objective

Remove `REGIONAL_LEADERSHIP` from user-visible persona selection for the MVP while retaining District Leadership and all existing backend authorization behavior.

## Scope

- Remove the Regional Leadership entry from the persona presentation catalogue.
- Ensure the workspace selector never renders Regional Leadership, even if an older backend allowlist still includes the role.
- Keep `REGIONAL_LEADERSHIP` access policies and backend role handling unchanged.
- Keep District Leadership and its existing workspace unchanged.

## Behavior

The persona selector will show Command Centre and the remaining permitted personas. Regional Leadership will be filtered at the presentation boundary. A direct or backend-only Regional Leadership role remains fail-closed and governed by existing access policy; this change does not grant or modify permissions.

## Verification

- A selector test proves Regional Leadership is absent when returned by the backend.
- Existing selector, navigation, and router tests remain green.
- The production frontend build succeeds.

