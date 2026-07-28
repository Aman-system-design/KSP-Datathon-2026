# Environment-aware Catalyst origin

## Goal

Make the deployed Slate client use the Catalyst environment that matches its public hostname without changing any persona, dashboard, report, authentication UI, or Development behavior.

## Runtime selection

- `acep.onslate.in` uses `https://kspdatathon2026-60077844198.catalystserverless.in` for both Catalyst authentication and `crime_intelligence_api`.
- `ace.onslate.in`, localhost, preview hosts, and existing builds continue using `https://kspdatathon2026-60077844198.development.catalystserverless.in`.
- `VITE_API_BASE` remains restricted to the Catalyst origin selected for the current hostname; arbitrary API origins stay rejected.

## Scope and isolation

The change is limited to `web/src/app/runtime.js` and its runtime tests. No backend, schema, datastore, persona, dashboard, report, or UI code is changed. The Production deployment will contain only the rebuilt web client.

## Failure handling

Unknown hostnames deliberately fall back to Development so existing local and preview workflows do not break. Production is selected only by an exact, case-insensitive hostname match.

## Verification

1. Add failing tests proving `acep.onslate.in` selects Production and Development/localhost remain unchanged.
2. Implement the smallest hostname-based origin selector.
3. Run the focused runtime tests, full web test suite, and production build.
4. Deploy only the web client to Production.
5. Verify `https://acep.onslate.in/` no longer reports `CATALYST_AUTHORIZATION_REQUEST_BLOCKED` or `CATALYST_FUNCTION_UNREACHABLE`, while `https://ace.onslate.in/` still loads through Development.
