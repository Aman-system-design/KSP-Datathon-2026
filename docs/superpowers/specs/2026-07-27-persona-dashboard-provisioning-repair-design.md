# Persona Dashboard Provisioning Repair

## Goal

Provision one distinct, editable, report-backed dashboard for District Leadership, Crime Analyst, and Station Operations without changing the existing State Leadership or Command Centre dashboards.

## Confirmed failures

- District and Crime Analyst provisioning submits the nonexistent `catalog.caseMaster` report source and undeclared fields. The governed report API rejects those definitions.
- Those templates also describe maps with an `overlay` property, while governed map reports require an authorized saved `mapViewId` and cannot contain report transforms.
- Provisioning warnings are discarded before the dashboard library renders, hiding setup failures.
- The Police Station dashboard is created and eight station reports execute. `Active Alerts` fails because the report runner receives base intelligence read services before the existing authorized `listAlerts` service is composed.

## Design

### District Leadership dashboard

Replace the invalid definitions with six viewer-scoped reports using only the existing governed sources and declared fields:

- command brief metrics;
- pattern type and case evidence;
- hotspot magnitude by authorized unit;
- anomaly signal and observed volume;
- district context indicators;
- alert lifecycle distribution.

The dashboard remains `District Intelligence Dashboard`, private to its owner, editable, and idempotently provisioned. No map report is created until a governed saved map view exists.

### Crime Analyst dashboard

Replace the invalid definitions with six distinct analytical reports using the governed pattern, hotspot, anomaly, area-risk, alert, and brief sources. The dashboard remains `Crime Analyst Dashboard`, private, editable, viewer-scoped, and idempotently provisioned.

### Police Station dashboard

Compose the existing authorized alert-list service into the report execution service before report creation. This makes `Active Alerts` use the same access checks, recipient filtering, current-rule validation, and station unit scope as the Alerts module. The other station-case reports and dashboard layout remain unchanged.

### Failure handling

The application must never silently treat incomplete provisioning as success. If a template cannot be completed, render the existing application with a safe setup warning containing only the template identity and stable public error code. Existing dashboards and modules remain usable.

## Data and authorization boundaries

- No raw table names, ZCQL, caller-supplied scope, or fabricated map identifiers.
- Report execution always uses the current viewer access object.
- Existing dashboards are matched by governed template identity and are not overwritten.
- State Leadership, Command Centre, report editing, dashboard editing, and station case scoping remain unchanged.

## Verification

- Template-contract tests validate every report through the real semantic registry and report-definition normalizer.
- Provisioning tests prove all three roles create exactly their matching dashboard and preserve existing dashboards.
- Report-service tests prove an alert report executes through the authorized alert service and returns zero rather than failing when no visible alerts exist.
- Existing backend and frontend suites, production web build, Catalyst function build/inspection, and schema validators must pass.
- After deployment, browser smoke verifies the three named dashboards and every report card, with special checks for Police Station `Active Alerts`.
