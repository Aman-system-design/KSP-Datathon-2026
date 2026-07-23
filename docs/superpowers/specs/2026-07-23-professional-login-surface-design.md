# Professional Login Surface Design

## Goal

Present Catalyst Authentication as a restrained, production-shaped Karnataka State Police access screen.

## Approved design

- Keep the existing split layout and Karnataka State Police emblem.
- Remove the invitation-only notice and all invitation instructions.
- Replace “Secure access” with “Sign in”.
- Use the subtitle “Access your Karnataka State Police workspace.”
- Preserve the native embedded Catalyst authentication form, password handling, redirect, error state, accessibility title, and responsive behavior.
- Retain a quiet footer stating that authentication is managed by Catalyst by Zoho.
- Use the existing Roboto typography, white surfaces, subtle borders, restrained shadow, and Karnataka accent strip.
- Do not add dependencies, decorative gradients, promotional copy, fake controls, or custom credential handling.

## Verification

- Login tests must confirm the removed text is absent and the approved heading and subtitle are present.
- The frontend test suite and production build must pass.
- The deployed `/login.html` must be browser-checked at desktop and narrow viewport widths.
