# Command Center Empty Shell Design

**Date:** 2026-07-24  
**Status:** Approved for implementation

## Purpose

Create a clean, isolated Command Center persona surface inside the existing KSP ACE React application. The first release establishes only the application shell. Its content canvas remains intentionally empty until subsequent features are defined.

The surface is reached through:

`https://ace.onslate.in/?persona=COMMAND_CENTER`

Existing personas, routes, backend services, and deployed data remain unchanged.

## Visible Surface

The shell follows the supplied reference image:

- a white horizontal header with the KSP emblem;
- “Karnataka State Police” and “Analytics · Crime · Enforcement” identity text;
- a centered, disabled search field reading “Search is available after governed indexing”;
- notification, user-avatar, and team controls on the right;
- a narrow navy left rail with Home, Analytics, Alerts, Map, Network, Reports, and Apps icons;
- Home selected by default; and
- a completely empty content canvas.

The default appearance is light. Dark and system appearances are available through the user-avatar menu. The dark theme changes the shell and canvas consistently without changing the information architecture.

The shell must not show cards, prompts, metrics, alerts, sample content, loading indicators, or fabricated intelligence.

## Behavior

- `COMMAND_CENTER` receives a dedicated shell component within the existing application.
- Existing persona shells and routes are not restyled or replaced.
- Rail items are accessible buttons with visible selected, hover, and focus states.
- Selecting a rail item updates its selected state, but the canvas remains empty until that destination is implemented in a later approved slice.
- Clicking the avatar opens an account menu containing Light, Dark, and System appearance choices.
- Appearance preference persists in browser-local storage.
- Search remains disabled until governed indexing is connected.
- Notification and team controls remain disabled and expose no invented counts or activity.
- The shell performs no intelligence API requests.
- Invalid or unauthorized persona access continues through the existing authentication and authorization boundary.

## Component Boundaries

- `CommandCenterShell`: owns the isolated page composition and selected rail destination.
- `CommandCenterHeader`: renders identity, disabled governed search, and utility controls.
- `CommandCenterRail`: renders the seven accessible navigation controls.
- `CommandCenterAppearanceMenu`: owns appearance selection and persistence.
- Shared brand assets, icon library, tokens, and accessibility conventions are reused where they match the reference.

These components remain independent of intelligence data and API clients so backend availability cannot blank the shell.

## Responsive Behavior

- Desktop preserves the reference structure: fixed header, narrow left rail, and open canvas.
- Smaller widths retain the header identity and essential controls without overlap.
- The rail remains compact and scroll-safe; it does not become a content sidebar.
- The empty canvas must not introduce accidental scrolling, clipping, or placeholder regions.

## Verification

Focused automated tests cover:

- parsing and accepting the `COMMAND_CENTER` persona;
- routing the persona to the isolated shell;
- rendering the empty canvas without intelligence API requests;
- selected rail-state changes;
- appearance selection and persistence; and
- preservation of existing persona behavior.

The full frontend test suite and production build must pass. Browser verification covers desktop and mobile layouts, light and dark appearances, console health, rail interaction, the avatar appearance menu, and the absence of framework error overlays.

## Catalyst Development Rollout

Before deployment, record the current Slate commit and deployment identifier as the rollback checkpoint. Deploy only the Slate web client to Catalyst Development.

The deployment must not change Functions, Data Store schemas or rows, Jobs, cron schedules, Authentication configuration, API Gateway, or Production resources.

Smoke-test `https://ace.onslate.in/?persona=COMMAND_CENTER` after deployment. Rollback consists only of redeploying the recorded prior Slate commit.

## Acceptance Criteria

The slice is complete when:

1. the approved persona URL opens the isolated shell;
2. the rendered structure closely matches the supplied reference image;
3. the content canvas is completely empty;
4. all seven rail controls render and expose selected/focus behavior;
5. light is the default and Light, Dark, and System choices work and persist;
6. the shell makes no intelligence API requests;
7. existing personas continue to behave as before;
8. automated tests, production build, and browser verification pass; and
9. Catalyst Development smoke verification passes with a documented rollback checkpoint.
