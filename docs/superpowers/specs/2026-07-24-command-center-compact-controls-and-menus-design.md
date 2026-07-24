# Command Center Compact Controls and Menus Design

## Goal

Further reduce the Command Center chrome and separate persona switching from appearance settings.

## Approved Visual Design

- The desktop header height is 56 pixels.
- The desktop rail width is 56 pixels.
- Rail buttons are 44 by 44 pixels and rail icons are 20 by 20 pixels.
- The organization logo is 32 pixels wide and the subtitle is 12 pixels.
- The search control is 200 by 38 pixels.
- The avatar, notification, and settings controls are 38 by 38 pixels.
- Desktop utility order is Search, Avatar, Notifications, Settings.
- The Team icon is removed.
- Existing narrow breakpoints remain overflow-safe and may reduce these controls further when required.

## Persona Menu

- Clicking the avatar opens a persona menu, not appearance options.
- The menu lists only personas authorized by the backend workspace contract.
- Selecting a persona navigates through the existing governed persona query mechanism.
- An `All workspaces` action clears the active persona and returns to the workspace selector.
- Selecting an action closes the menu.

## Settings Menu

- A new gear button opens the appearance menu.
- The appearance menu contains Light, Dark, and System.
- Existing appearance persistence remains unchanged.
- Selecting an appearance closes the menu.
- Opening one header menu closes the other.

## Architecture

`AuthorizedApplication` passes the backend-authorized persona list and governed navigation callbacks into `CommandCenterShell`. The shell owns the two mutually exclusive menu states. `CommandCenterHeader` renders the compact utilities and delegates persona and appearance choices without making authorization decisions.

## Scope and Safety

- No backend, schema, authentication, or authorization changes.
- No new persona values are invented or exposed.
- No change to the workspace selector confirmation flow.
- Deploy only the Catalyst Slate client after a clean Development preflight.

## Verification

- Add failing component tests for compact dimensions, Team removal, avatar persona menu, settings appearance menu, menu exclusivity, and governed persona navigation.
- Run focused tests, the full frontend suite, and the production build.
- Verify desktop and narrow layouts in the deployed in-app browser.
- Verify avatar persona selection and `All workspaces` navigation.
- Verify the settings gear changes appearance and both menus close after selection.
