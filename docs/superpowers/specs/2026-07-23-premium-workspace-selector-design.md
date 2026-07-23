# Premium Workspace Selector Design

## Objective

Replace the tall demonstration-persona list with a compact, production-shaped workspace chooser that fits a standard desktop viewport and provides a functional Command Centre entry.

## Experience

- Preserve the existing authenticated header, Karnataka State Police identity, and sign-out action.
- Present six workspaces in a three-column by two-row grid on desktop: Command Centre, State Leadership, Regional Leadership, District Leadership, Crime Analyst, and Station Operations.
- Each workspace is a selectable card with one meaningful icon, workspace name, operational purpose, and authorization scope.
- Command Centre is visually distinguished as a large-display operational workspace and opens the existing `/command-centre` route.
- The five personas remain restricted to the roles returned by the backend. Command Centre is exposed only when the authenticated role is `DEMO_PRESENTER`, which already has server-routed access to that screen.
- A single Continue action opens the selected destination. Keyboard navigation and radio semantics remain intact.

## Responsive behavior

- Desktop: three columns, two rows, no page scrolling at 1920×1080.
- Tablet: two columns.
- Mobile: one column with normal document scrolling.

## Visual system

- White surfaces on the existing cool-gray Catalyst-like canvas.
- Navy text, restrained blue selection state, fine neutral borders, subtle elevation.
- No decorative gradients, oversized pills, fake status indicators, or unnecessary explanatory blocks.
- Existing Roboto typography and shared button primitives remain unchanged.

## Authentication boundary

This change must not modify Catalyst SDK setup, embedded sign-in markup, authentication CSS, session detection, or sign-out behavior.

