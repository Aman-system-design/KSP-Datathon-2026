# Premium Catalyst Authentication Footer

## Goal

Restore the separate premium authentication attribution beneath the demo credentials card without reintroducing clipping or scrolling.

## Design

- Keep the Catalyst sign-in iframe and demo credentials card unchanged.
- Place `Authentication managed by Catalyst` outside and immediately below the demo card.
- Separate the attribution with a thin, restrained divider.
- Center the attribution and use the existing shield-check glyph in a muted gold tone.
- Keep the row compact enough to remain inside the login shell at supported desktop viewport heights.
- Preserve the existing mobile stacking behavior.

## Scope

Only `SignInRequired.jsx`, its focused tests, and login-specific CSS may change. Authentication routing, persona switching, dashboards, reports, backend functions, and Catalyst configuration are out of scope.

## Verification

- Component test confirms the attribution is outside the demo card.
- CSS contract confirms centered layout, divider, compact spacing, and gold icon styling.
- Auth, router, and viewport regression tests pass.
- Production build passes.
- Live Slate verification confirms the original Catalyst embedded form remains intact.
