# Premium Login Enhancement Design

## Objective

Upgrade the Karnataka State Police sign-in page from a plain enterprise form to a smooth, premium, macOS-inspired experience. The page remains light, calm, official, and recognizably KSP rather than dark, neon, or overtly science-fictional.

## Visual Direction

Use a "Frosted Command Glass" direction:

- Retain the existing two-column layout and prominent KSP emblem on the left.
- Use a softly tinted identity panel with restrained depth and precise spacing.
- Present the Catalyst sign-in form in a bright, lightly translucent access panel.
- Use a pale blue-grey canvas with subtle light blooms and an extremely faint precision grid.
- Apply macOS-inspired surface details: 20–24px outer radius, hairline borders, layered soft shadows, gentle blur, and smooth 180–250ms interactions.
- Strengthen the sign-in hierarchy through typography, spacing, input focus treatment, and a premium blue primary action.
- Avoid dark styling, neon effects, excessive gradients, target rings, decorative clutter, and sci-fi interface elements.

## Layout and Components

The outer React login shell remains a responsive split surface:

1. The identity panel contains the existing configured KSP primary logo, organization name, and optional product tagline.
2. The access panel contains the existing secure-access header, Catalyst iframe host, load-failure message, and Catalyst management notice.
3. At narrow widths, the identity panel becomes a compact horizontal header and the access panel follows beneath it.

The embedded Catalyst form remains code-native and is restyled only through the existing supplied authentication stylesheet. Email, password, OTP, recovery, and validation states must remain reachable inside the reserved iframe area.

## Functional Preservation

The redesign must not change:

- `auth.mountSignIn` behavior or arguments.
- The Catalyst stylesheet URL or service URL.
- Iframe discovery, title normalization, or mutation observation.
- Email, password, OTP, forgot-password, validation, or authentication flows.
- Load-failure handling and accessible error reporting.
- Existing organization branding configuration.

No new authentication controls, alternate providers, session logic, or API behavior are introduced.

## Accessibility and Motion

- Preserve semantic headings, image alternatives, iframe title, and alert roles.
- Maintain visible keyboard focus and sufficient text, border, and control contrast.
- Keep interactive targets comfortably sized on desktop and mobile.
- Limit motion to subtle hover, focus, and surface transitions lasting 180–250ms.
- Disable non-essential motion when `prefers-reduced-motion` is enabled.

## Responsive Behavior

- Large desktop: centered split shell with a prominent identity panel and balanced form width.
- Small laptop: the full shell and all Catalyst recovery actions remain inside the dynamic viewport, with access-panel scrolling available when necessary.
- Mobile: single-column shell, compact brand header, full-width form controls, and natural document scrolling.

## Verification

- Run the existing sign-in component and viewport contract tests.
- Run the relevant web test suite and production build.
- Verify the rendered page in a browser at desktop, small-laptop, and mobile dimensions.
- Exercise the visible Catalyst email step and confirm the iframe remains usable for subsequent password, OTP, recovery, validation, and error states.
- Compare the final render against the approved Frosted Command Glass direction for layout, typography, palette, spacing, surface depth, and interaction polish.

## Rollback

Keep implementation changes narrowly scoped to the login shell, authentication stylesheet, and their direct tests. Record the approved specification separately and create a dedicated implementation commit so the enhancement can be reverted without disturbing authentication logic or unrelated workspace changes.
