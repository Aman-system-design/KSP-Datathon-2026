# Embedded Catalyst Login Restoration Design

## Goal

Restore the Catalyst email/password sign-in form inside the branded KSP ACE login page so users can complete the normal Email, Next, and Password flow without leaving `ace.onslate.in`.

## Scope

This change is limited to the unauthenticated login surface. It does not change Catalyst identity validation, application routing, persona selection, dashboards, reports, backend APIs, Production configuration, or authenticated session handling.

## Authentication architecture

`SignInRequired` continues to call the official Catalyst SDK `mountSignIn` method with the existing Catalyst CSS URL and root service URL. The SDK-generated iframe remains mounted in the access column instead of being removed and converted into a hosted sign-in link.

The application does not collect, submit, proxy, log, or persist credentials. Email and password input remain inside the Catalyst-owned iframe, and Catalyst continues to perform authentication and redirect handling.

## Visual behavior

- Keep the existing premium two-column KSP login shell.
- Display the Catalyst email/password form directly in the right column.
- Keep the demo credentials card below the form with both copy buttons.
- Keep the gold shield and `Authentication managed by Catalyst` footer below a divider.
- Remove `Continue to secure sign in` from the normal flow.
- Size the iframe to its content within safe viewport bounds and avoid nested scrollbars.
- Preserve the existing responsive single-column layout on small screens.

## Failure and retry behavior

The component observes the SDK host for an iframe and treats the iframe load event as the ready signal. If mounting rejects, no iframe appears, or the iframe remains unavailable for five seconds, the page displays a bounded error and a `Refresh sign in` button.

`Refresh sign in` clears the failed mount state and asks the Catalyst SDK to mount the form again in the same page. It does not navigate to the hosted Zoho Portal sign-in page. Repeated retries remain bounded to explicit user clicks.

## Isolation and compatibility

- Reuse the existing `applyCatalystFrameHeight` helper for safe iframe sizing.
- Keep the existing Catalyst CSS customization file.
- Do not modify authenticated application code or backend authorization.
- Do not add a custom login endpoint or direct password API.
- Do not deploy to Production unless separately authorized.

## Testing

Automated tests will verify:

- the SDK-generated iframe remains mounted on the ACE page;
- no hosted sign-in link is rendered;
- iframe title, scrolling behavior, and height synchronization are applied;
- a five-second missing-frame timeout shows the bounded error and `Refresh sign in`;
- clicking `Refresh sign in` performs one new SDK mount attempt;
- a successful retry clears the error and keeps the iframe embedded;
- demo credential copy controls and the Catalyst footer remain unchanged;
- existing authentication, routing, persona, and dashboard regression suites still pass.

Live Development verification will confirm the Email, Next, and Password stages remain inside `ace.onslate.in`, successful Catalyst authentication returns to the application, and Production remains unchanged.
