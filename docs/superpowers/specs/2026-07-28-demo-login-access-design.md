# Demo Login Access Design

## Goal

Help judges enter the existing Catalyst-hosted sign-in flow by displaying the supplied demo email and password on the unauthenticated application screen.

## Scope

- Add one compact **Demo access for judges** card beneath the existing embedded Catalyst sign-in surface.
- Display the supplied email and password as static text.
- Add a small accessible copy button beside each value.
- Show brief, non-blocking copied feedback after a successful clipboard action.
- Keep the existing responsive layout and Catalyst visual language.

## Isolation

The change is limited to the unauthenticated `SignInRequired` presentation and its tests/styles. It must not modify Catalyst SDK initialization, authentication callbacks, login submission, session handling, routing, persona selection, dashboards, API code, or deployment configuration.

## Interaction

Each copy button writes only its associated displayed value to the browser clipboard. The buttons use explicit accessible names. Copy success is announced through a small `role="status"` message that clears automatically. If clipboard access fails, the credential remains visible for manual selection and no authentication behavior is affected.

## Responsive behavior

The card remains inside the existing scrollable access column. It uses compact rows on desktop and mobile so password, recovery, and OTP steps in the Catalyst iframe remain reachable.

## Testing

- Component test: both supplied values render only on the sign-in screen.
- Component test: each copy button copies the correct value and exposes success feedback.
- Regression tests: the Catalyst sign-in container and existing authentication-managed label remain present.
- Build and existing authentication/router suites must pass before deployment.

## Security note

The credentials are intentionally public demo credentials supplied for judging. They are presentation data only and are never used by application code to authenticate automatically, prefill Catalyst inputs, persist a session, or call an API.
