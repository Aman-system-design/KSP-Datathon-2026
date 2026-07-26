# AI-Assisted Utility Alerts Design

## Objective

Make the Utilities alert workflow visibly and honestly AI-assisted while preserving human control. Command Centre must be a first-class alert recipient and must be selected by default for every new policy, together with Crime Analyst.

## Product Positioning

The analytical engine produces the signal; the alert policy governs when that signal is delivered. The interface must not imply that a numeric rule is itself AI.

The three available utilities already use substantive analytical methods:

- Emerging Hotspot Intelligence uses density-based spatial clustering (DBSCAN).
- Trend Anomaly Intelligence uses robust baseline comparison based on median and median absolute deviation (MAD).
- Cross-District Pattern Intelligence uses multi-signal pattern fusion.

These methods will be described as explainable analytical models. The UI will use the term **AI-assisted detection**, not autonomous prediction, and will continue to state that human review is required.

## Alert Policy Experience

### Recipients

Add `COMMAND_CENTER` as a supported recipient throughout the UI, API validation, persistence, and evaluation contract. A new policy starts with both Command Centre and Crime Analyst selected. Existing policies retain their stored recipients unchanged.

### AI-Assisted Detection Explanation

The policy form will contain one compact information panel placed near the policy controls. It will not be a dashboard or a collection of cards. The panel includes:

- The utility's analytical method and model or method version.
- A two- or three-sentence explanation of what the model examines and what its output means.
- A clear separation between machine-generated signal and human-governed delivery threshold.
- A visible human-review limitation.

Example hotspot copy:

> This utility uses density-based spatial clustering to identify groups of recent incidents that are unusually concentrated in an authorized area. The model creates an explainable hotspot signal from location, time window, and case density; this policy then decides when that signal is important enough to notify operational teams. Every alert remains an investigative lead and requires human review.

Equivalent utility-specific explanations will be supplied for anomaly detection and pattern fusion. The text must remain concise enough to scan but must explain the mechanism and governance in meaningful sentences rather than one-line labels.

## Evaluation Result

After **Run evaluation**, the result will explain the flow in plain language:

1. Published model findings were assessed within the selected scope and time window.
2. Findings meeting the human-governed policy qualified for delivery.
3. Non-qualifying findings were suppressed, and qualifying findings created or reused governed alerts.

The existing evaluated, matched, suppressed, and alert-link values remain authoritative. No fabricated confidence or generated explanation will be introduced if the backend does not return it.

## Visual Direction

Follow the existing Catalyst-inspired ACE language: white and pale-blue surfaces, restrained borders, one orange analytical accent, compact spacing, and no oversized hero treatment. The explanation panel must be visually secondary to the editable policy and must not increase cognitive load with multiple cards.

## Command Centre Entry Point

Utilities is a first-class operational module, not a subsection of the generic Intelligence workspace. The Command Centre rail will expose a dedicated **Utilities** destination that opens `/utilities?persona=COMMAND_CENTER`. Other Command Centre module buttons will navigate to their governed routes instead of changing only the selected icon. Leadership and analyst personas retain Utilities access during the MVP, but Command Centre is the primary operational entry point.

## Contract and Compatibility

- Add `COMMAND_CENTER` to the recipient allowlist used by frontend and backend validation.
- Keep the persisted `RecipientRolesJSON` representation unchanged.
- Do not rewrite existing policies automatically.
- Preserve existing role and scope authorization for creating, updating, and evaluating rules.
- Preserve synthetic-data and human-review disclosures.

## Testing

- Frontend test: Command Centre appears and is selected by default with Crime Analyst.
- Frontend test: each available utility displays its correct method and substantive explanation.
- Frontend test: evaluation result explains model assessment and policy qualification without changing counts.
- Navigation test: Command Centre exposes Utilities and routes it to `/utilities?persona=COMMAND_CENTER`, while Analytics remains `/intelligence`.
- Backend tests: `COMMAND_CENTER` is accepted, persisted, returned, and embedded in generated alert evidence.
- Regression tests: invalid and duplicate recipient roles remain rejected; existing stored policies render unchanged.

## Explicit Non-Goals

- No last-minute QuickML, Zia, or external LLM dependency.
- No claims of crime prediction or autonomous decision-making.
- No cosmetic AI-generated prose presented as model output.
- No production deployment until tests and live Development verification pass.
