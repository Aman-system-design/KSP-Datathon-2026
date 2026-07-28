# Catalyst Authentication Origin and Footer Design

## Goal

Restore functional Catalyst authentication on the Slate custom domain and keep the authentication attribution fully visible at constrained desktop heights.

## Root Cause

The Catalyst SDK generates a sign-in iframe on `https://ace.onslate.in/accounts/...`. The custom Slate origin serves the SPA fallback HTML for the iframe's encryption-script request instead of the Catalyst encryption JavaScript. The account page then throws while reading the missing encryption key and remains on its loading spinner.

The public Catalyst initialization identifies `https://accounts.zohoportal.in` as the configured authentication domain. The same generated account URL works from that origin: the demo credentials advance through password authentication and redirect successfully to the ACE workspace selector.

Separately, the external “Authentication managed by Catalyst” footer extends beyond the login shell at short desktop heights because the access column is taller than the available shell.

## Design

After Catalyst creates its sign-in iframe, normalize only iframe URLs that meet both conditions:

- the current origin is the ACE application origin; and
- the pathname begins with `/accounts/`.

Replace only the URL origin with `https://accounts.zohoportal.in`. Preserve the complete pathname, query string, CSS URL, service URL, recovery URL, and redirect parameters. Do not rewrite unrelated frames or URLs already using the Catalyst authentication domain.

Keep the existing Catalyst SDK, session checks, sign-out behavior, credentials, and application redirect flow unchanged.

Move the authentication attribution into a compact final row inside the demo credentials card. Remove the external footer and its reserved status gap. Copy feedback remains an accessible live region but does not reserve permanent vertical space when empty.

## Safety and Scope

- Login and authentication boundary only.
- No changes to personas, dashboards, reports, routing, or data APIs.
- Do not expose private keys or credentials in source.
- The configured authentication origin is a public Catalyst/Zoho origin already emitted by `__catalyst/sdk/init.js`.
- If iframe normalization cannot produce a valid URL, retain the generated URL and surface the existing load failure behavior.

## Verification

- Unit-test origin normalization, query preservation, and no-op cases.
- Integration-test that the mounted iframe is normalized once without remounting Catalyst.
- Test the compact attribution markup and responsive layout contract.
- Run auth, router, and viewport regression tests plus the production build.
- On the live site, complete email and password authentication and confirm redirect to the workspace selector.
- Verify the attribution remains inside the card at constrained desktop and mobile sizes.

