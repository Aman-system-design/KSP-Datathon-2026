# Access ACE Precision HUD Design

## Objective

Give the Catalyst form area a restrained high-technology character inspired by precision HUD interfaces while retaining the deployed light Frosted Command Glass shell and macOS-like polish.

## Visual Treatment

- Replace the visible `Sign in` heading with `Access ACE` while retaining underlying sign-in semantics for accessibility and Catalyst compatibility.
- Frame the embedded form with fine blue corner brackets rather than a heavy enclosing border.
- Add a short segmented status rail above the heading.
- Use extremely faint technical grid and circuit-trace details behind the form controls.
- On input focus, strengthen the nearest corner detail and show a restrained horizontal scan shimmer.
- Retain the premium blue button and add a subtle travelling highlight on hover.
- Keep Forgot Password visually clear and reachable.
- Preserve the existing light palette, translucent surfaces, generous whitespace, rounded controls, and soft shadows.

The design excludes a wireframe face, biometric imagery or claims, dark surfaces, neon green, fake telemetry copy, dense sci-fi decoration, and additional visible security badges.

## Implementation Boundary

The enhancement is limited to the Catalyst authentication stylesheet and its direct contract tests. It must not change React session logic, `auth.mountSignIn`, iframe mounting or title normalization, service URLs, organization branding, API behavior, or authentication state.

The visual `Access ACE` label may use CSS presentation while the original Catalyst sign-in semantics remain available to assistive technology. Password, OTP, validation, error, recovery, and federated-auth content must never be hidden by the decoration.

## Interaction and Accessibility

- Decorative HUD elements must ignore pointer input.
- Input, button, recovery, validation, password, and OTP controls remain keyboard reachable.
- Focus states retain sufficient contrast and never depend on animation alone.
- Motion stays within 180–250ms and is disabled under `prefers-reduced-motion`.
- The layout remains usable at the existing embedded 340px form width and on mobile.

## Verification and Rollback

- Add failing CSS contract tests for the visible `Access ACE` treatment, HUD corner/rail primitives, focus scan state, hover highlight, and reduced-motion handling.
- Run authentication, viewport, complete web, and production-build verification.
- Verify the deployed email, password, Next, and Forgot Password controls in the browser at desktop and mobile widths.
- Deploy only the Catalyst Slate client after a clean Development preflight.
- Keep the change in a dedicated commit so it can be reverted and the previous Slate client redeployed without altering Functions, data, Jobs, API Gateway, Authentication configuration, or Production.
