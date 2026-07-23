# Compact Premium Login Design

## Objective

Refine the existing Catalyst-embedded authentication screen so it fits within the first viewport, feels appropriate for a police intelligence platform, and remains visually consistent with Catalyst's restrained white enterprise interface.

## Approved Direction

Use a compact white enterprise shell. Do not introduce a dark command-centre theme, decorative rings, coloured top strips, marketing copy, or additional authentication controls.

## Layout

- The authentication shell must fit inside the available dynamic viewport without vertical scrolling at standard desktop and laptop sizes.
- Set the shell maximum width to 900px and cap its height at 520px while allowing it to shrink with the dynamic viewport.
- Use a 300px identity column and the remaining width for authentication.
- Keep the mobile layout stacked and free from horizontal overflow.
- Preserve the existing branded loading screen without visual changes.

## Identity Panel

- Use a calm neutral white-grey surface separated by a single subtle border.
- Display the supplied Karnataka State Police emblem clearly, without target rings, ornamental lines, or animated decoration.
- Retain only the organization name and product name beneath the emblem.

## Authentication Panel

- Constrain the embedded Catalyst form to 340px.
- Consolidate the current two detached security indicators into one quiet security context row.
- Keep Catalyst's real email, password, OTP, forgot-password, validation, and session behavior unchanged.
- Use 48px controls, accessible focus indication, restrained eight-pixel radii, and clear form hierarchy.
- Reduce unused space below the forgot-password action while reserving sufficient room for Catalyst's password and OTP steps.

## Responsive and Accessibility Requirements

- Use dynamic viewport units with a safe fallback.
- Preserve keyboard navigation and visible focus states.
- Maintain at least 4.5:1 text contrast.
- Ensure controls remain at least 44px high.
- Respect reduced-motion preferences.

## Verification

- Add regression tests for viewport-aware shell sizing, absence of decorative strips/rings, and constrained form width.
- Run the complete frontend test suite and production build.
- Deploy only the Catalyst Slate frontend.
- Verify the root URL in the live in-app browser at desktop and mobile dimensions, including the email and password stages when accessible.

## Explicit Non-Goals

- No authentication-provider replacement.
- No change to Catalyst user provisioning or forgot-password behavior.
- No new marketing content, fake security claims, or simulated authentication.
- No change to the approved application loading screen.
