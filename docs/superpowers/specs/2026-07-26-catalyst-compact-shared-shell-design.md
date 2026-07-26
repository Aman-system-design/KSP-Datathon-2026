# Catalyst Compact Shared Shell Design

## Purpose

Modernize the authenticated ACE platform shell and Command Center dashboard with a Catalyst-inspired visual language while preserving existing product behavior. The result must feel contemporary, fast, and consistent across every authenticated screen. Login, recovery, and workspace-selection entry screens remain unchanged.

## Approved Direction

The approved direction is **Catalyst Compact**: crisp white chrome, a deep Karnataka-blue navigation rail, restrained blue accents, modern outline icons, compact labeled navigation, and lighter analytical surfaces. The shell takes inspiration from Catalyst's clarity and spacing without copying its branding, hero content, search, support action, or deployment controls.

The existing Command Center report hierarchy remains intact. This work improves presentation and interaction quality; it does not change report definitions, governed data, map behavior, chart meaning, dashboard selection, report opening, persona authorization, or route semantics.

## Shared Authenticated Header

`PlatformHeader` becomes the single shared authenticated header primitive. Command Center uses the same primitive rather than maintaining a visually separate header.

The header contains:

1. the existing Karnataka State Police identity and product context on the left;
2. notifications;
3. settings; and
4. the user avatar as the final right-aligned control.

Search and support controls are absent. Notifications retain the existing alerts destination or current disabled behavior where alerts are unavailable. Settings exposes only Appearance. The avatar continues to own persona/workspace and account behavior. Menus are mutually exclusive, keyboard accessible, dismissible, and restore focus to their trigger.

The shared header applies to all routes rendered inside the authenticated application shell, including Command Center, dashboards, reporting, intelligence, geospatial, alerts, administration, and persona workspaces. It does not wrap authentication, recovery, or workspace-selection screens.

## Navigation

The Command Center left rail becomes a compact Catalyst-style labeled sidebar. Each existing destination keeps its current identifier, callback, and icon meaning. Labels are visible on standard desktop widths, with a compact icon-first form at constrained widths. The active destination uses a light inset surface and blue foreground rather than a heavy traditional button. Hover and focus treatment must not move surrounding layout.

The wider platform sidebar adopts compatible spacing, icon weight, active-state treatment, and color tokens so moving between Command Center and other authenticated workspaces feels continuous. Existing route visibility and authorization rules remain authoritative.

## Command Center Dashboard Surfaces

Report cards use a shared surface family with a white or dark-theme surface, subtle one-pixel borders, restrained shadows, consistent radii, and disciplined internal spacing. Titles, scope metadata, visualization areas, footers, overflow controls, and open actions retain their current semantics and event handlers.

The map remains the primary analytical surface in the initial layout, with Statewide FIR Volume and Crime Category Share retaining their current positions and behavior. Lower reports continue in the existing dashboard flow. The redesign must not insert a marketing hero, decorative KPI strip, invented data, support control, or global search.

Menus, drawers, report-opening affordances, and dashboard selectors receive short opacity/transform transitions. Motion must communicate state rather than decorate the screen. `prefers-reduced-motion` disables nonessential transitions.

## Appearance and Tokens

The shell uses shared semantic tokens for background, surface, elevated surface, primary text, muted text, border, focus, accent, sidebar background, active navigation, shadow, radii, and motion. Light, dark, and system appearance remain supported through the existing persisted preference. Appearance selection remains the only settings capability.

Typography uses the existing bundled Roboto family with a clearer scale and weight hierarchy. Icons use the existing Lucide family where available, with consistent stroke weight and optical sizing.

## Performance Contract

The redesign must add no perceptible interaction lag.

- No large raster assets, image-generation assets, backdrop blur, continuous animation, or layout-affecting hover transforms are introduced.
- Shared shell state remains local and minimal; opening a menu must not rerender report visualizations or recreate map/chart data.
- Stable component boundaries and callbacks isolate header, navigation, and report rendering.
- CSS transitions are limited to transform, opacity, color, background-color, border-color, and shadow, generally between 120 and 180 milliseconds.
- Existing lazy-loaded route and visualization boundaries remain intact.
- Bundle verification must pass; new dependencies are prohibited unless a demonstrated functional need appears during implementation.

## Responsive Behavior

At desktop widths the header stays single-line and the Command Center rail shows icons with short labels. At narrower authenticated layouts the rail becomes compact without hiding primary content or causing horizontal overflow. Utility controls remain in the approved Bell, Gear, Avatar order. Dashboard report responsiveness continues to use the existing layout rules and must preserve usable map and chart dimensions.

## Accessibility

All shell controls retain accessible names, visible keyboard focus, adequate target sizes, and logical tab order. Icon labels remain available to assistive technology even when the rail visually compacts. Menus use appropriate roles and state attributes. Light and dark themes must preserve readable contrast. Reduced-motion behavior is mandatory.

## Error and State Handling

Header or navigation styling must never mask route, report, or authorization errors. Report loading, empty, stale, and failure states retain their existing behavior. If branding assets fail, textual organization identity remains available. Appearance storage failure falls back to the current resolved theme without blocking navigation.

## Testing and Acceptance

Implementation is accepted when:

- all authenticated routes use the shared Catalyst Compact header;
- login, recovery, and workspace-selection screens are unchanged;
- header controls appear in Bell, Gear, Avatar order;
- search and support controls are absent;
- settings contains only Appearance and persists light, dark, and system choices;
- avatar/persona/account behavior remains functional;
- Command Center navigation shows icons and short labels on desktop;
- existing dashboard, report, map, chart, picker, and open interactions still work;
- menus are mutually exclusive and keyboard accessible;
- desktop and compact layouts have no unintended overflow or clipped controls;
- reduced-motion, light mode, and dark mode render correctly;
- focused component tests, the complete web test suite, production build, and bundle check pass; and
- browser inspection shows no perceptible delay when opening menus, switching shell navigation, or opening existing reports.

## Scope Boundary

This project does not redesign authentication screens, add search, add support, add new settings, change reporting data or APIs, replace dashboard mechanics, or introduce new platform capabilities. It creates one shared authenticated shell and applies the approved Catalyst Compact treatment to the Command Center and compatible platform navigation surfaces.
