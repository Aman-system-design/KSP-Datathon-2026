# Login Viewport Fit Design

## Goal

Keep the complete production sign-in card visible without an inner scrollbar on standard desktop viewports, while retaining safe document scrolling on short and mobile screens.

## Design

The Catalyst sign-in iframe keeps its existing integration and width. Desktop-only vertical dimensions and spacing are reduced enough for the iframe, judge access card, and managed-authentication footer to fit inside the existing shell. The access column must not create its own scroll container at normal desktop heights.

For short desktop viewports, the outer page becomes the single scroll container and the shell grows naturally. Existing mobile stacking remains unchanged. No authentication, routing, copy-button, or persona behavior changes.

## Verification

- Add a CSS regression test that rejects desktop inner scrolling and requires a short-height fallback.
- Run the focused login tests, full web tests, and production build.
- Render the unauthenticated page at desktop and mobile sizes and verify content visibility, scroll ownership, console health, and copy-button interaction.

