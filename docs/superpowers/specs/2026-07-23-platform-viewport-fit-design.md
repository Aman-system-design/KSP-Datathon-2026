# Platform Viewport Fit Design

## Goal

Keep every platform surface within the available browser viewport by default. Scrolling appears only inside the content region that genuinely exceeds its available space; primary actions must never be clipped.

## Layout Contract

- `html`, `body`, and `#root` occupy the full available height and allow grid children to shrink.
- The authenticated application shell is exactly one dynamic viewport high (`100dvh`) and never creates document-level scrolling.
- The top bar, navigation rail, and contextual navigation remain fixed within the shell.
- The workspace content column owns vertical scrolling and uses `min-height: 0` so CSS Grid can constrain it correctly.
- Full-canvas workspaces such as Geospatial Studio consume the remaining shell height; their toolbars remain visible and their panels or results scroll independently.
- Login, password setup, recovery, and invitation screens fit without scrolling at normal desktop heights. At reduced heights, only the authentication content panel scrolls; the identity panel and outer page remain stable.
- Workspace selection fits the first desktop viewport when its available role set allows it. If roles or accessibility zoom make that impossible, the selector panel becomes the scroll owner.
- Mobile surfaces use natural vertical scrolling because fixed desktop navigation would reduce usable space.

## Responsive Rules

- Use `dvh` for the current visual viewport and retain a `vh` fallback.
- Do not solve height pressure by reducing font sizes, control heights, or touch targets.
- At short desktop heights, reduce nonessential outer padding before enabling inner scrolling.
- Never hide overflow on a region containing form actions unless a descendant is explicitly designated as the scroll owner.

## Authentication Boundary

Catalyst owns the embedded form markup. The host constrains its frame to the available height, while the Catalyst stylesheet makes the form document vertically scrollable when recovery or password setup contains more controls than the sign-in form. Existing Catalyst authentication, forgot-password, and invitation behavior remains unchanged.

## Verification

- Automated CSS contract tests guard the shell height, shrinkability, and scroll ownership rules.
- Browser verification covers a normal desktop viewport, a short desktop viewport, and a mobile viewport.
- Primary actions on sign-in, password setup, recovery, and workspace selection must be visible or reachable through the designated inner scroll area.
- The application shell and map workspace must not produce unintended body-level horizontal or vertical scrolling.

## Non-goals

- No visual redesign, typography change, or navigation restructuring.
- No authentication logic changes.
- No per-page hard-coded viewport calculations when the shared shell can own the constraint.
