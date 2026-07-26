# Command Centre MVP Contract

Status: Approved for implementation on 24 July 2026

## Immediate priority

Build the Command Centre first. Selecting the Command Centre workspace must always open a complete, clean home surface. The Command Centre does not use the standard application sidebar.

The first delivery is the Command Centre home and its navigation structure. QuickML, governed analytics, maps, reports and wall-display capabilities are added behind this stable surface one functional path at a time.

## Users and operating modes

The Command Centre supports two connected modes:

1. **Operator console** — used by an officer on a desktop or laptop to ask questions, configure views, investigate signals and control what is shown.
2. **Wall display** — a presentation-safe synchronized view for large command-centre screens. It contains no editing or investigation controls.

Both modes use the same saved report and dashboard definitions. They are not separate hard-coded demonstrations.

## Approved functional vertical slice

Natural-language command -> Catalyst QuickML -> validated report specification -> authorized data query -> deterministic analytics -> interactive visualization -> contributing FIR drill-down -> save/share/wall display.

The deterministic analytics layer includes DBSCAN hotspot detection and Median/MAD trend anomaly detection. QuickML interprets an officer's question and creates a constrained report specification; it does not invent FIRs, scores or conclusions.

## First supported questions

- Show robbery hotspots in Bengaluru for the last 30 days.
- Compare vehicle-theft trends across authorized districts.
- Show stations with an unusual increase in burglary.
- Open the FIRs contributing to a selected hotspot or signal.

## Command Centre home

The home must be calm and operational, not a wall of generic dashboard cards. It provides:

- clear KSP ACE identity and current workspace;
- an obvious entry to ask the intelligence system a question;
- access to live operational view, saved views and wall-display mode;
- visible system/data readiness without technical deployment clutter;
- no left sidebar;
- no invented alerts, counts, maps or AI responses.

## Proof standard

A capability is not complete merely because backend code exists. It is complete only when:

- a user can reach it from the Command Centre;
- the UI calls the real deployed service;
- changing the question changes the governed query;
- results are traceable to authorized source FIRs;
- role and geographic scope are enforced;
- unsupported or ambiguous requests ask for clarification;
- failures and unavailable dependencies are shown honestly;
- saved reports can be reused by dashboards and the wall display;
- automated tests and browser evidence cover the working path.

No canned answers, decorative fake alerts or hard-coded analytical outputs may be presented as working intelligence.

## Delivery sequence

1. Command Centre home and routing.
2. QuickML command-to-report specification.
3. Governed query execution over Catalyst data.
4. DBSCAN/MAD analytical execution with provenance.
5. Modern interactive map/chart and FIR drill-down.
6. Save, share and wall-display synchronization.
7. Reuse the same engine for the Station workspace.

## Current implementation truth

The home surface may expose the intended entry points, but it must label unavailable services honestly until their deployed integrations have been verified. Homepage completion does not mean QuickML or the analytical pipeline is complete.
