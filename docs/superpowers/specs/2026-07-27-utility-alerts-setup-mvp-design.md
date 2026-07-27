# Utility Alerts Setup MVP Design

**Date:** 2026-07-27  
**Status:** Approved for implementation  
**Scope:** Frontend presentation only

## Outcome

Make the existing utility alert-rule capability immediately understandable as a setup for routing analytical findings to relevant operational personas for human review and action.

The visible product term is **Alerts (Setup)**. The experience explains this bounded flow:

```text
utility findings -> configured routing -> human review, assignment and action
```

The MVP demonstrates that alerts can be configured. It does not claim continuous, real-time or 24/7 monitoring.

## Experience

Every utility detail page replaces the visible **Alert Policy** terminology with **Alerts (Setup)**. Supporting labels use the same plain-language model:

- Add alert setup
- Edit alert setup
- New alert setup
- Save setup
- Alert setups

The section introduction contains one compact Monitor → Route → Human action explanation:

- **Monitor:** the utility produces governed analytical findings;
- **Route:** configured thresholds, windows, severity and recipient personas determine alert delivery;
- **Human action:** operational teams review, assign and act on every alert.

The setup controls remain progressively disclosed beside Input & Logic and Outputs. The experience must fit the existing Catalyst-inspired ACE utility layout and must not introduce a new dashboard, modal workflow or duplicated static form.

## Persona and authorization behavior

All personas that can open Utilities see the **Alerts (Setup)** concept consistently.

Existing backend authorization remains unchanged. The frontend does not grant new actions, scopes or recipient permissions. Existing roles that can manage rules retain create, edit, save and evaluation behavior; other personas retain the response produced by the current authorization and rule-management boundaries.

## Functional boundary

Reuse the existing:

- `AlertPolicy` component and policy form;
- utility alert-rule API contracts;
- threshold, evaluation-window, severity and recipient fields;
- optimistic update and idempotency behavior;
- manual Run evaluation action;
- generated-alert link into the alert inbox;
- AI-assisted detection disclosure when server metadata is available.

No Data Store table, Function, schema, model, authentication, report, dashboard or alert-workflow contract changes are included.

Area Attention continues to state honestly that alert creation is unavailable for that utility in this MVP.

## Safety and error behavior

- Existing alert setups and stored rules are not rewritten.
- Failed loads, saves, version conflicts and evaluations retain their current safe error handling.
- The UI does not claim background scheduling, continuous observation or autonomous action.
- Analytical findings remain machine-assisted signals; human review is required before action.
- No synthetic assignment, team ownership or workflow status is invented when the backend does not return it.

## Verification

Automated tests must prove:

- all visible section and action labels use Alerts (Setup) terminology;
- existing create, edit, save, evaluation, recipient and error behavior remains intact;
- supported personas can see the setup concept without authorization expansion;
- Area Attention remains unavailable for alert creation;
- AI-assistance metadata remains optional and safely validated;
- no unrelated report, dashboard or utility contract behavior changes.

Run the focused utility tests, the complete frontend suite and the production build. Before deployment, browser-test representative utilities for Command Centre, leadership, station and analyst personas.

## Acceptance

The slice is accepted when a user can open a utility and understand within seconds that alerts can be configured to route relevant analytical findings to operational personas for human work, while every previously working alert-rule action behaves unchanged and the interface makes no unsupported automation claim.

## Explicit non-goals

- continuous or scheduled monitoring;
- automatic team assignment;
- new alert workflow states;
- email, SMS or external messaging;
- new recipient roles or permissions;
- QuickML or another model integration;
- backend, Function, Data Store or schema deployment;
- Production deployment.
