# Adaptive Catalyst Login Height Design

## Objective

Remove the excessive empty space between the embedded Catalyst sign-in form and the demo credentials while preserving every authentication state and preventing page or panel scrollbars at supported desktop sizes.

## Scope

This change is limited to the login component, its styles, and focused login tests. It must not change Catalyst authentication calls, credentials, routing, persona switching, reports, dashboards, backend services, or datastore behavior.

## Design

The login component will measure the rendered height of the same-origin Catalyst sign-in iframe content after the frame loads and whenever its content changes. It will expose a bounded height to the existing login container and iframe.

- The email-only step uses its measured compact height.
- Password, validation-error, recovery, and other taller states expand the iframe and push the demo credentials downward.
- Measurements are clamped between conservative minimum and maximum heights to prevent clipping and large layout jumps.
- If iframe content cannot be inspected, the component retains the current safe fixed height.
- The outer login card remains constrained to the viewport; small screens use normal page scrolling instead of an inner panel scrollbar.

The demo credential card, copy controls, Catalyst branding, and authentication-managed footer remain unchanged.

## Failure Handling

Iframe measurement is progressive enhancement. Cross-origin access errors, missing iframe documents, or observer failures must be caught and must not affect sign-in. Cleanup disconnects observers and load handlers when the component unmounts.

## Testing

Focused tests will verify:

1. Catalyst sign-in is mounted with the existing arguments.
2. The iframe keeps its accessible title and disabled native scrolling.
3. Compact measurements reduce the reserved height within bounds.
4. Taller password/error states expand the reserved height within bounds.
5. Unavailable iframe measurement falls back without throwing.
6. Observers and handlers are cleaned up.
7. Desktop layout has no document or nested panel scrollbar at the reported judge viewport.
8. Mobile and short viewports retain usable page scrolling.

The production build and existing authentication/router tests must pass before deployment. Live verification will cover the email and password steps without changing any other screen.

## Deployment Safety

Implementation will be made from `origin/main` in an isolated worktree. Only the login files and their focused tests will be committed. The deployment will use the existing Slate application and preserve `https://ace.onslate.in`.
