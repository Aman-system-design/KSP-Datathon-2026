# Login Vertical Balance Design

## Goal

Remove the excessive visual space below Catalyst's “Forgot Password?” link and vertically balance the right-side sign-in group, while retaining the existing left-aligned “Sign in” heading and all authentication behavior.

## Scope

- Login page layout only.
- Preserve the 360px Catalyst iframe height so password and error states remain fully visible.
- Move the demo credentials card upward by approximately 40px using outer-page CSS spacing.
- Rebalance the right-side access group within the existing desktop shell.
- Preserve the current mobile layout, copy controls, credentials, branding, and Catalyst integration.
- Do not change personas, dashboards, routing, session handling, or authentication code.

## Implementation Design

Adjust the desktop rules in `web/src/styles/app.css`. The demo credentials card will use a modest negative top margin to consume unused iframe whitespace without modifying or inspecting Catalyst's cross-origin form. The access group remains centered by its existing grid alignment. A responsive override will remove or reduce the negative margin on narrow screens where content flows vertically.

The Catalyst frame remains 360px. This avoids clipping password, validation, recovery, or error states that may be taller than the initial email form. The “Sign in” heading remains owned by Catalyst and left-aligned.

## Verification

- Add or update CSS contract tests for the desktop spacing and mobile override.
- Run the focused authentication and viewport-layout tests.
- Run the production build.
- Verify the deployed email and password stages at 1920×1080 have no page scrollbar, no overlap, and a compact gap below “Forgot Password?”.

