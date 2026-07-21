# KSP Crime Decision Intelligence Platform

Production-shaped Datathon 2026 Challenge 02 MVP for explainable district-policing intelligence on Catalyst by Zoho.

> **Readiness:** Functional Development deployment using synthetic data. This repository is not certified for operational police use and contains no real KSP records.

## What works

- PDF-aligned fragmented FIR ingestion and validation across 26 source entities
- persisted hotspot, anomaly, cross-district pattern, network, repeat-identity and area-risk findings
- role/unit/case-scoped reads using Catalyst Authentication identities and access profiles
- idempotent alert assignment, acknowledgement, notes, escalation, conclusion and outcome workflows
- HMAC-linked audit events, optimistic concurrency and retry reconciliation
- configurable reports, dashboards and role defaults
- React SPA on Catalyst Slate and Node.js Catalyst Functions
- deterministic positive/negative analytics controls and local 1K/10K/50K scale benchmark

The transparent analytics engine creates alerts. Planned LLM capability may explain authorized stored evidence but must never detect crime, create an alert or change workflow state.

## Architecture

```text
PDF-aligned source extracts
  -> validation and Catalyst Data Store source mirror
  -> bounded/versioned analytics Job
  -> persisted explainable findings and evidence
  -> authenticated role-aware API
  -> dashboards, Active Signals and accountable workflow
```

Authoritative documents:

- [PRD](PRD.md)
- [Architecture](Architecture.md)
- [Engineering rules](Rules.md)
- [Delivery phases](Phases.md)
- [Visual design](Design.md)
- [Project memory](docs/PROJECT_MEMORY.md)
- [Challenge traceability](docs/architecture/challenge-traceability.md)

## Local verification

Requirements: Node.js 24 and npm. The deployed refresh Function is separately compatibility-tested for Node.js 18.

```bash
npm install
npm run verify
npm run intelligence:benchmark
```

`npm run verify` executes backend/frontend tests, the production web build, both Function bundle checks and both schema validators. The scale benchmark generates feature records locally; it does not write 50,000 FIRs to Catalyst.

## Configuration

Runtime configuration is server-side and fail-closed. Copy `.env.example` only for local setup; never commit a real audit key or OAuth token. Catalyst deployment values belong in Function configuration/Connections, not browser code.

The current runtime is deliberately locked to the approved Catalyst Development project. Moving to another organization requires an explicit tenant/configuration migration; changing the project guard is not a production shortcut.

## Deployment boundary

- Catalyst Data Store: relational source, intelligence and workflow records
- Catalyst Functions: authenticated API and scheduled analytics
- Catalyst Slate: React SPA
- Catalyst Authentication: current-user identity
- Catalyst API Gateway: required before operational exposure for routing, authentication and throttling
- Catalyst QuickML: approved future Evidence Copilot boundary

All remote Development or Production changes require a reviewed preflight and deployment record. Production deployment, real KSP ingestion, public signup and bulk remote performance loads are not authorized by this repository.

## Security and policing safeguards

- synthetic records are visibly labelled;
- rank alone never grants access;
- similarity is not proof of guilt or association;
- no individual future-crime prediction or sensitive-demographic targeting;
- significant findings retain method version, period, evidence and limitations;
- public errors and operational logs exclude evidence payloads and credentials;
- human confirmation remains authoritative.

## Remaining production work

Operational deployment still requires enterprise SSO confirmation, API Gateway policy, service objectives, monitored capacity tests on representative KSP volumes, backup/recovery and retention policies, incident response, security assessment and formal model governance.

## Data

All included records and names are deterministic synthetic fixtures created for the challenge. Do not add company data, police operational data, personal credentials or identifiable real-person information.
