# Command Center Compact Search Design

## Goal

Make the Command Center header feel simpler by anchoring a compact search field beside the profile controls, following the supplied ServiceNow reference.

## Approved Design

- On desktop, the search field has a fixed width of 270 pixels instead of expanding toward the center of the header.
- Header utilities remain right-aligned in this order: Search, Avatar, Notifications, Team.
- Utilities use a compact 10-pixel gap.
- The area between the Karnataka State Police identity and the utilities remains empty.
- The search field remains blank and disabled until governed indexing is available.
- At narrow widths, the existing search-icon presentation remains unchanged.
- Existing light, dark, and system appearance behavior remains unchanged.

## Alternatives Considered

- A 360-pixel search field was rejected because it still reads as a dominant central control.
- A click-to-expand search icon was rejected on desktop because it hides the search affordance and diverges from the supplied reference.

## Scope

This is a CSS-only refinement of the existing Command Center header. It does not add search behavior, alter routing, change the sidebar, or modify backend services.

## Verification

- Add a regression assertion for the desktop search width and utility gap.
- Run the focused Command Center tests, full frontend suite, and production build.
- Verify the deployed desktop header visually and confirm the narrow layout still has no horizontal overflow.
