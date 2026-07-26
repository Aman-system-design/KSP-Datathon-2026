# ACE Intelligence Utilities MVP Design

**Date:** 2026-07-26
**Status:** Approved for implementation
**Deployment boundary:** Catalyst Development using challenge demonstration data

## 1. Outcome

Make analytics understandable as independent, reusable **Intelligence Utilities** rather than as disconnected dashboards.

Each utility communicates one stable lifecycle:

```text
governed data -> analyze -> explain -> alert -> deliver
```

Monitoring, alerts, maps and reports are delivery surfaces of a utility. They are not the utility itself.

## 2. Frozen MVP scope

The Utilities catalogue contains four openable utilities:

1. Cross-District Pattern Intelligence
2. Emerging Hotspot Intelligence
3. Trend Anomaly Intelligence
4. Area Attention Intelligence

Pattern, hotspot and anomaly utilities support functional persisted alert rules. Area Attention remains available as an analytical utility, but its alert policy is not presented as active until validated.

Utilities are categorized through registry metadata:

- Patterns & Networks
- Spatial Intelligence
- Trends & Anomalies
- Risk & Prioritization

The catalogue supports **All** plus category filtering. Categories do not change authorization.

## 3. Experience design

### 3.1 Shared ACE shell

Reuse the existing Command Centre visual language:

- Roboto with Noto Sans Kannada fallback;
- persistent white global header;
- compact navy service rail;
- generous white space and restrained borders;
- Lucide icons and short labels;
- no marketing hero, generic KPI grid or decorative dashboard clutter.

The experience is Catalyst-inspired in clarity and restraint, but retains ACE identity and does not reproduce a Catalyst service page.

### 3.2 Utilities homepage

The Utilities homepage is an internal service catalogue. It shows:

- compact title and one-sentence definition;
- the shared lifecycle once;
- lightweight category filters;
- one row per utility containing icon, name, purpose, distinctive analytical core, primary output, status and Open affordance.

It does not expose rule forms, run history, model parameters, evidence counts or QuickML controls.

### 3.3 Utility page

Every utility reuses the same five-stage visual grammar while changing its identity, method, evidence and outputs:

1. **Data** — authorized input contract.
2. **Analyze** — utility-specific analytical method.
3. **Explain** — evidence and limitations.
4. **Alert** — bounded rule and routing policy.
5. **Deliver** — monitoring, maps and reports.

The first view explains the utility in seconds. Detailed configuration is progressively disclosed through Input & Logic, Alert Policy and Outputs. Monitoring is an output, not the default definition of a utility.

## 4. Utility registry

A server-owned, versioned registry defines the fixed MVP utilities. Each definition contains:

- stable utility key and version;
- name, description, category and icon token;
- supported finding type;
- input and analytical method labels;
- evidence and limitation contract;
- allowed alert-rule fields and bounds;
- supported outputs;
- availability state.

The browser never invents utility capabilities. New utilities are added through registry entries plus a tested evaluator adapter, not through copied pages.

## 5. Alert rules and evaluation

Persist bounded rules with:

- rule ID, utility key and utility version;
- enabled state;
- authorized geographic scope;
- threshold values permitted by the utility;
- evaluation window;
- severity;
- recipient roles;
- optimistic version, creator and timestamps.

The MVP does not support arbitrary formulas, SQL, scripts or free-form conditions.

Evaluation consumes already-computed, persisted intelligence findings. It never reruns analytical algorithms in the browser. A qualifying result creates a governed alert containing the rule version, finding reference, evidence reference, analytical method/version, scope, limitations and demonstration-data provenance.

Alert creation is idempotent. The deduplication key combines the rule, finding and analytical run so repeated evaluation does not create duplicate alerts. Disabled, unauthorized, invalid or stale rules create no alert.

Evaluation occurs:

- manually through a governed **Run evaluation** action; and
- after a successful intelligence refresh publication.

The MVP makes no continuous or real-time monitoring claim.

## 6. Existing platform integration

- Reuse persisted hotspot, anomaly, pattern and area-attention outputs from `intelligence-core`.
- Generalize alert projection beyond the current pattern-only behavior for validated hotspot and anomaly policies.
- Reuse the existing alert inbox, detail, evidence, note, workflow and audit boundaries.
- Reuse the reporting semantic registry so utility outputs can be visualized without a second query engine.
- Preserve current role and unit authorization for every catalogue, rule, finding, alert and report operation.

## 7. QuickML boundary

QuickML is not shown on the Utilities homepage, utility lifecycle or primary jury path.

An optional Evidence Explainer may later appear inside an evidence or output view only when:

- a real QuickML endpoint and server-side authenticated connection exist;
- authorized evidence is minimized and schema-bounded;
- responses remain evidence-grounded and display limitations;
- repeated deployed integration tests pass;
- timeout, unavailable and invalid-response states fail honestly.

QuickML never detects a pattern, calculates a score, creates an alert, changes workflow state or expands access. If the endpoint is not proven, the control is absent rather than labelled coming soon.

## 8. Error and safety behavior

- A failing utility does not blank the catalogue or other utilities.
- A failed evaluation publishes no partial alerts.
- Unsupported rule values are rejected server-side with stable errors.
- Stale rule versions cannot overwrite newer configuration.
- Unauthorized scope is hidden and rejected, not merely redacted in the browser.
- Similarity remains explicitly non-conclusive and requires human verification.
- Area Attention is labelled as an attention signal, not crime prediction.
- Demonstration-data provenance appears in evidence and report metadata, not as a dominant global aspiration badge.

## 9. Verification

Automated coverage must prove:

- registry and category contracts;
- catalogue and shared utility rendering;
- bounded rule validation and optimistic updates;
- role and geographic authorization;
- pattern, hotspot and anomaly positive and negative controls;
- alert idempotency and deduplication;
- failed evaluation atomicity;
- evidence, method, limitation and provenance retention;
- report-source reuse;
- responsive layout and keyboard navigation.

The deployed smoke path is:

```text
Utilities -> open utility -> inspect lifecycle -> configure/test rule
-> run evaluation -> open created alert -> inspect evidence
-> open monitoring or report output
```

## 10. Explicit deferrals

- arbitrary alert-rule builder;
- user-authored utility code or plugins;
- live streaming and real-time claims;
- email, SMS or external messaging delivery;
- custom QuickML training for crime prediction;
- visible QuickML placeholders;
- Production deployment or operational-readiness claims;
- redesign of unrelated platform screens.

## 11. Acceptance

The slice is accepted when a judge can understand what a utility is, distinguish the four utilities, open each one, inspect its data-to-delivery lifecycle, configure and evaluate an authorized rule for the three active alert types, open a resulting evidence-linked alert, and reach a real report or monitoring output without encountering fabricated results or nonfunctional controls.
