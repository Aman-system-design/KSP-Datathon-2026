---
name: reviewing-challenge-alignment
description: Use when preparing any commit, push, pull request, Catalyst deployment, or substantial architecture change for the KSP Datathon 2026 Challenge 02 project.
---

# Reviewing Challenge Alignment

## Overview

Gate every change against the official challenge, approved architecture, Catalyst constraint, policing safeguards, and verification evidence. A polished screen is not proof of capability.

## Mandatory workflow

1. Identify the review range with `git status` and `git diff`. Review staged and unstaged changes; use the branch base for a PR or push review.
2. Run `scripts/check-required-files.ps1` from this skill. Resolve missing foundations before continuing.
3. Read `docs/architecture/challenge-traceability.md`, `docs/architecture/business-architecture-blueprint.md`, `docs/architecture/role-access-and-experience-design.md`, and `docs/PROJECT_MEMORY.md`.
4. Read `references/review-contract.md` completely.
5. Classify every changed file as direct requirement delivery, enabling infrastructure, neutral maintenance, or scope drift.
6. Inspect implementation, tests, fixtures, configuration, and observed verification output. Never infer behavior from filenames, labels, comments, or screenshots alone.
7. Apply every gate in the review contract. Record evidence and file references.
8. Use `references/output-template.md` exactly. Return one overall verdict: **PASS**, **WARN**, or **FAIL**.

## Verdict rules

- **FAIL:** Stop the push or deployment. Required challenge behavior regressed; a Catalyst-native equivalent was bypassed without an approved exception; safety, authorization, evidence, or data-integrity boundaries were violated; or claimed capability lacks verification.
- **WARN:** Continue only with written justification, owner, and follow-up. Use for contained debt or non-critical partial coverage that does not falsely claim completion.
- **PASS:** Allow the change only when its purpose, requirement effect, architecture fit, and verification evidence are explicit.

The highest-severity unresolved finding determines the verdict. Do not average findings.

## Non-negotiable checks

- Preserve visible coverage of every Challenge 02 requirement in `challenge-traceability.md`.
- Prefer Catalyst services whenever a matching Catalyst capability exists.
- Preserve evidence drilldown, explainability, human review, audit history, synthetic-data labels, and geographic authorization.
- Reject individual future-crime prediction, sensitive demographic targeting, causal claims from correlation, or AI text unsupported by stored evidence.
- Accept neutral tests, refactors, and reliability work when they preserve contracts and provide verification.
- Reject Challenge 01 feature drift unless Challenge 02 coverage is complete and the scope addition is explicitly approved.

## Pressure rule

Deadlines, visual polish, sunk cost, demo convenience, and an AI developer's confidence never lower the gate. Missing evidence is not evidence of success.

## Quick reference

| Change | Expected verdict |
|---|---|
| Removes case-level evidence drilldown | FAIL |
| Uses Supabase instead of Catalyst Data Store without exception | FAIL |
| Adds individual recidivism prediction | FAIL |
| Adds an anomaly chart without baseline, version, fixture, or test | FAIL |
| Refactors API error handling with regression tests | PASS |
| Adds aggregate district correlation with caveats and tests | PASS |
| Adds a chatbot before Challenge 02 is complete | WARN or FAIL |

## Red flags

- "The UI proves it works."
- "We can add tests after the submission."
- "This third-party service is faster."
- "The model score is only a suggestion" when it targets an individual.
- "The feature name is present, so the requirement is covered."
- "This change is too small for alignment review."
- "The deadline requires an exception" without explicit approval.

Any red flag requires a fresh evidence-based review.

## Common mistakes

- Reviewing only changed UI and ignoring data, API, authorization, or jobs.
- Demanding that every neutral change add a challenge feature.
- Treating synthetic outputs as real KSP findings.
- Reporting PASS without commands, tests, and inspected evidence.
- Updating traceability wording to match weak code instead of fixing the implementation.

