# Role, Access, and User Experience Design

**Product:** KSP Crime Decision Intelligence Platform  
**Status:** Approved role architecture; MVP implementation depth is locked in [`mvp-build-contract.md`](mvp-build-contract.md).
**Related document:** [`business-architecture-blueprint.md`](business-architecture-blueprint.md)

## Why this document exists

The platform serves different levels of policing. A state leader, district SP, SHO, analyst, and investigator should not receive the same information or be allowed to perform the same actions.

This document defines:

- who uses the platform;
- what decisions each user must make;
- what information each user may see;
- how far each user may drill down;
- what actions each user may perform;
- which actions are prohibited or require additional authorization.

## Authorization foundation

The production schema separates rank, designation, employee assignment, and organizational hierarchy. The platform must respect that separation.

Effective access is determined by:

> **Rank hierarchy + designation responsibilities + assigned unit scope + explicit platform permissions**

### Rank hierarchy

`Employee.RankID` links an employee to `Rank`. `Rank.Hierarchy` represents seniority, with a lower hierarchy number indicating a higher rank.

Rank contributes to authorization, but rank alone never grants access.

### Designation responsibilities

`Employee.DesignationID` links an employee to `Designation`. The designation represents the employee's current functional responsibility. Two people with similar ranks may have different duties and therefore different platform permissions.

### Assigned organizational scope

`Employee.UnitID` identifies the employee's current unit. `Unit.ParentUnit` creates the organizational tree, while `Unit.TypeID` describes the unit type.

This supports both common structures:

- State → Range → District → Sub-division/Circle → Police Station
- State → Commissionerate → Division/Sub-division → Police Station

The platform must traverse the configured unit tree rather than hard-code a fixed number of organizational levels.

### Explicit platform permissions

Permissions define allowed operations such as viewing aggregate intelligence, viewing case evidence, assigning alerts, exporting briefs, administering models, or auditing activity.

### Important rules

- A senior rank does not automatically receive unrestricted case-data access.
- An employee normally sees the assigned unit and authorized subordinate units.
- Transfers change scope through the current `Employee.UnitID` assignment.
- Analysts may receive evidence access through explicit assignment even when they do not hold a command designation.
- Platform administrators do not automatically receive sensitive case-data access.
- All access to sensitive evidence and all intelligence-workflow actions must be auditable.

## Role Level 1: State Police Leadership

### Who belongs to this experience?

This experience is intended for authorized state-level leadership such as the DGP and other senior command officers. Exact designations will be mapped during implementation configuration rather than hard-coded into the interface.

### What decisions must leadership make?

The state-level experience should answer:

1. What changed across Karnataka?
2. What requires immediate leadership attention?
3. Which patterns cross district or commissionerate boundaries?
4. Which regions are deteriorating or improving?
5. Are important intelligence alerts being acted upon?

Leadership should not need to inspect every FIR to answer these questions.

### Default experience: State Intelligence Brief

When an authorized state leader signs in, the platform opens with a State Intelligence Brief rather than a crowded general-purpose dashboard.

The brief contains:

- an evidence-grounded executive summary for the selected period;
- top emerging crime patterns;
- statewide risk and hotspot map;
- district and commissionerate comparison;
- significant crime-category changes;
- cross-jurisdiction intelligence alerts;
- assigned-action and escalation status;
- visible data-quality, confidence, and limitation notices.

### Leadership drilldown

The evidence journey is:

**State → Pattern or alert → Affected regions → Evidence summary → Authorized cases**

The default experience remains summarized. Raw FIR or personal details appear only when the user is authorized and chooses to inspect the evidence.

### Leadership actions

Authorized state leadership may:

- acknowledge an intelligence alert;
- request analyst or regional verification;
- assign an alert to regional, commissionerate, or district leadership;
- escalate or change operational priority;
- mark a pattern for continued monitoring;
- add a leadership note;
- review response progress and outcome;
- export an evidence-backed executive brief.

### Leadership restrictions

The State Leadership experience must not allow the user to:

- edit source FIR records;
- manually alter calculated analytical results;
- treat similarity or risk as proof of guilt;
- change the evidence attached to an alert;
- view sensitive personal details without appropriate authorization;
- receive an AI-generated claim that cannot be traced to stored evidence.

### Flagship leadership scenario

The platform presents the following intelligence:

> A late-evening robbery pattern has expanded across three adjoining jurisdictions. Twelve FIRs share geographic, temporal, offence, and modus-operandi signals. Two accused-link relationships require analyst verification.

The leadership user can:

1. inspect the affected jurisdictions and evidence summary;
2. review the confidence and known limitations;
3. request analyst verification;
4. assign responsibility to the appropriate subordinate command;
5. monitor the response and review the recorded outcome.

This scenario demonstrates the complete flow from cross-jurisdiction detection to accountable action.

## Role Level 2: Regional or Commissionerate Leadership

### Why this level exists

Range leadership may supervise multiple police districts. Commissionerate leadership may supervise divisions and police stations within a major city. The platform uses the configured `Unit` hierarchy, so the same experience can adapt its labels and subordinate units without hard-coding one organization structure.

This is intentionally a lean command layer rather than a separate collaboration product.

### What decisions must this level make?

The experience should answer:

1. Which subordinate units require attention?
2. Is a pattern spreading between districts, divisions, or stations?
3. Which alerts need coordination across unit boundaries?
4. Are hotspots moving or expanding?
5. Are responsible subordinate units responding?

### Default experience

The Regional or Commissionerate Intelligence View contains:

- an evidence-grounded summary for the authorized command area;
- map and trend views for that area;
- comparison of subordinate units;
- emerging cross-unit patterns;
- high-priority alerts;
- assigned-unit and status information;
- visible confidence, limitations, and data-quality notices.

For a range, subordinate comparisons may show districts. For a commissionerate, they may show divisions or other configured units.

### Drilldown

**Range or Commissionerate → Subordinate unit → Alert or pattern → Evidence summary → Authorized cases**

### Permitted actions

Authorized users may:

- acknowledge an alert;
- request analyst verification;
- assign one responsible subordinate unit;
- identify additional supporting units;
- escalate the alert to state leadership;
- mark the pattern for monitoring;
- add a command note;
- review status and outcome;
- export a scoped intelligence brief.

All coordination data remains part of the alert record. The MVP will not build a separate coordination-room module.

### Restrictions

This level cannot:

- edit source FIR records;
- access unrelated jurisdictions;
- modify calculated evidence;
- treat similarity as proof of criminal association;
- view sensitive personal details without explicit authorization;
- close another unit's work without the required permission.

### Practical MVP scenario

The platform finds a similar late-night robbery pattern across three subordinate units. The authorized leader reviews the evidence summary, assigns one responsible unit, adds the others as supporting units, requests analyst verification, and escalates the pattern if it is confirmed.

The workflow remains simple, auditable, and directly connected to the challenge.

## Role Level 3: District or Division Leadership

### Who belongs to this experience?

This experience serves district command, such as an SP, and equivalent division command within a commissionerate, such as an authorized DCP. The interface adapts to the assigned `Unit` and its subordinate hierarchy.

### What decisions must this level make?

The experience should answer:

1. What requires attention in my jurisdiction today?
2. Which police stations show unusual change?
3. Where are hotspots emerging, growing, or declining?
4. Which crime categories are increasing?
5. Which repeat-offender or case links require investigation?
6. Which alerts remain unverified or unresolved?
7. What should analysts examine first?

### Default experience: District Intelligence Pulse

The opening view contains:

- a plain-language intelligence summary;
- a jurisdiction map with hotspots and area-risk signals;
- changes over the last 24 hours, 7 days, and 30 days;
- police-station comparison;
- crime-category trends;
- new anomaly alerts;
- repeat-offender and co-accused signals;
- active assignments and overdue reviews;
- visible data-quality warnings.

The experience emphasizes change from the unit's normal baseline rather than simply listing units with the highest raw totals.

### Practical feature: Attention Queue

The Attention Queue prevents leaders from having to inspect every chart. It prioritizes:

1. new and severe anomalies;
2. expanding hotspots;
3. cross-station or cross-district patterns;
4. repeat-offender or network signals requiring verification;
5. alerts approaching their review deadline;
6. data-quality problems affecting intelligence.

Every queue item explains why it appears and links to its evidence.

### Drilldown

The primary journey is:

**District or Division → Police Station → Hotspot or Alert → Evidence → Authorized cases**

Authorized users may also filter or drill down by crime category, period and time band, geographic area, case status, gravity, and alert status.

### Permitted actions

District or division leadership may:

- acknowledge an alert;
- assign it to an analyst or subordinate unit;
- request verification;
- set priority and due date;
- escalate it upward;
- mark it for monitoring;
- record a decision or command note;
- review evidence and analyst feedback;
- close the intelligence workflow with an outcome;
- export a district intelligence brief.

### Resource-priority guidance

The platform may identify areas that deserve attention and explain why. For example:

> Evening property-offence risk is elevated around two station boundaries because of a 42% increase, a new spatial cluster, and repeated activity in the same time band.

The platform must not autonomously assign patrol teams or prescribe enforcement action. The accountable officer decides the response.

### Police-station comparison safeguard

The platform compares crime patterns, changes, data quality, and alert-response status. It must not produce an unexplained best-station or worst-station score.

Raw totals can be misleading because stations differ in population, geography, crime mix, reporting behavior, and data completeness. Comparisons must show context and limitations.

### Flagship district scenario

The platform informs district leadership:

> Burglary activity is 3.1 standard deviations above the station's historical weekly baseline. Seven incidents form two evening clusters. Three cases share similar entry-method text patterns.

The leader opens the affected station, reviews the hotspot and evidence summary, assigns verification to an analyst, sets a deadline, receives the analyst's findings, and records the response and eventual outcome.

## Role Level 4: Crime Analyst

### Why this role matters

The Crime Analyst is the platform's most important working user. Leadership receives summarized intelligence, but analysts determine whether a detected pattern is meaningful, misleading, duplicated, or distorted by poor-quality data.

### What questions must the analyst answer?

1. Why did the system create this alert?
2. Which records and features contributed to it?
3. Is the pattern statistically and operationally meaningful?
4. Are the linked cases genuinely similar?
5. Is missing or incorrect data distorting the result?
6. What findings should be sent to leadership?
7. Should the alert be confirmed, monitored, rejected, or escalated?

### Default experience: Analyst Workbench

The analyst's work queue contains:

- newly assigned alerts;
- high-priority unassigned alerts within authorized scope;
- alerts awaiting verification;
- data-quality exceptions;
- approaching deadlines;
- monitored patterns that have changed;
- draft findings awaiting submission.

Each item shows alert type, severity and confidence, affected units, detection time, assignment and deadline, reason for prioritization, and evidence completeness.

### Alert Investigation Workspace

Opening an alert creates one investigation workspace with four connected areas.

#### System finding

The analyst sees what was detected, when it was detected, its geographic and organizational scope, confidence or severity, calculation/model version, and known limitations.

#### Evidence

The evidence area may include:

- contributing FIRs;
- crime heads and sub-heads;
- dates and time bands;
- locations and hotspot membership;
- acts and sections;
- gravity and case status;
- accused and co-accused links;
- arrest and chargesheet information;
- relevant similarities extracted from `BriefFacts`.

#### Visual analysis

The workspace combines a timeline, map, trend comparison, case-similarity view, offender network, and feature-contribution explanation.

These views remain synchronized. Selecting an authorized case in one view highlights the same case in the other active views.

#### Data-quality panel

The analyst can see missing or invalid coordinates, incomplete dates, duplicate records, missing accused information, unknown unit references, insufficient baseline history, and unavailable text evidence.

### Analyst tools

The analyst may:

- filter evidence by period, station, crime type, and severity;
- compare the current period with a historical baseline;
- expand or narrow the geographic or time window;
- inspect network paths between cases and accused persons;
- add or remove a case from a working hypothesis;
- annotate evidence;
- request correction of a data-quality issue;
- save an investigation draft.

Changing the working hypothesis does not alter the source record or original model output. The system preserves the original finding and the analyst's interpretation separately.

### Structured analyst conclusion

The analyst selects one conclusion:

- Confirmed pattern
- Partially supported
- Continue monitoring
- Duplicate of an existing alert
- Insufficient evidence
- False positive
- Data-quality issue

The submission includes a summary, supporting evidence, contradicting evidence, analyst confidence, recommended next step, and limitations.

### Evidence Pack

After verification, the platform creates an evidence pack containing the original alert, analytical method and version, supporting cases, maps and analytical views, analyst conclusion, notes, limitations, and complete audit history.

This is the traceable artifact returned to leadership.

### Analyst restrictions

The analyst cannot:

- edit source FIR records;
- delete inconvenient evidence;
- modify the original model output;
- declare guilt or confirmed criminal association;
- access records outside authorized scope;
- escalate restricted evidence without permission;
- submit an AI-written conclusion without explicit analyst confirmation.

### Flagship analyst scenario

An analyst receives the cross-district robbery alert. Two contributing cases contain invalid coordinates. The analyst excludes them only from the working hypothesis, confirms that eight cases share strong temporal, geographic, legal, and modus-operandi signals, marks two cases as weakly related, and submits a partially supported conclusion with limitations.

This scenario demonstrates that the platform does not blindly trust its AI.

## Role Level 5: Station Command and Investigating Officer

### Why these roles share an experience

Station command and investigating officers need much of the same local case and alert context. They therefore share one Operational Intelligence View, while designation, assignment, case authority, and explicit permissions control which information and actions each receives.

This avoids building two nearly identical applications.

### Station Command

#### What questions must station command answer?

1. What changed within the station jurisdiction?
2. Which local areas or time bands require attention?
3. Which alerts have been assigned to the station?
4. Which cases support those alerts?
5. What response or verification is due?
6. Are local data-quality problems affecting the analysis?

#### Default station view

The station view contains:

- local intelligence summary;
- station hotspot map;
- 24-hour, 7-day, and 30-day trends;
- local anomaly alerts;
- assigned alerts and deadlines;
- repeat-offender and link signals;
- cases requiring data review;
- recently completed actions.

#### Permitted station-command actions

Station command may:

- acknowledge an assigned alert;
- assign verification to an authorized officer;
- add a station response note;
- request district or analyst support;
- mark an alert for monitoring;
- submit progress and outcome;
- escalate a pattern that extends outside station scope.

Station command cannot alter source FIR records or calculated evidence through this platform.

### Investigating Officer

#### What questions must an investigator answer?

1. Why was this case linked to an alert?
2. Which related cases or accused persons is the officer authorized to inspect?
3. What evidence supports the suggested relationship?
4. What information is missing or contradictory?
5. What verification has been assigned?
6. How should findings be reported?

#### Default investigator view

The investigator view contains:

- assigned cases and verification tasks;
- alert context;
- case timeline;
- authorized related cases;
- accused and co-accused network;
- arrest, chargesheet, act, and section information;
- location and time similarities;
- evidence notes and deadlines.

#### Permitted investigator actions

An investigator may:

- inspect assigned evidence;
- add an investigative note;
- mark a suggested link as supported, unsupported, or unknown;
- report incorrect or incomplete data;
- attach a verification result;
- request broader analyst review;
- submit the assigned task.

The investigator's judgment does not overwrite the original AI finding. Both remain visible in the audit history.

### Shared evidence safeguards

The interface must distinguish:

- System-detected signal
- Analyst-verified finding
- Officer-reported information
- Unverified relationship
- Confirmed source record
- Data-quality warning

This prevents users from confusing an algorithmic suggestion with verified police evidence.

### Scope control

Station command normally sees its station, assigned work, and authorized linked evidence. An investigator normally sees assigned cases, assigned alerts or tasks, and related evidence explicitly permitted by the platform.

Neither role receives unrestricted district or statewide access.

### Flagship operational scenario

A station receives an alert concerning three evening burglaries. The SHO reviews the local hotspot and assigns verification to an investigating officer. The officer identifies one unsupported similarity, records the findings, and requests analyst review. The analyst updates the working hypothesis, and district leadership receives the verified conclusion and station response.

## Shared Command Centre Presentation Mode

The Command Centre is a future authenticated presentation mode, not a separate unrestricted role. It provides large-screen awareness of approved aggregate intelligence, alert status, analytics freshness, and—after the Challenge 02 core is complete—prioritized CCTV, verified public/social, and major-event signals.

It does not expose unrestricted FIR evidence, personal details, or investigation controls on a shared display. A user who needs to investigate must open the relevant evidence through an individually authenticated and authorized workstation experience.

Detailed deferred behavior is defined in [`deferred-signal-and-operational-expansion.md`](deferred-signal-and-operational-expansion.md).

## Governance Roles: Platform Administrator and Auditor

The Platform Administrator and Auditor share one Governance Console, but their permissions remain strictly separated.

### Platform Administrator

The administrator keeps the platform operational. This is a technical role, not a policing-intelligence role.

#### What questions must the administrator answer?

1. Are data imports and scheduled jobs working?
2. Are APIs, Functions, and analytical services healthy?
3. Are records failing validation?
4. Which model or calculation version is active?
5. Are users mapped to the correct roles and units?
6. Has any configuration changed unexpectedly?

#### Administrator view

The Governance Console provides:

- service and deployment health;
- data-ingestion status;
- failed validation records;
- scheduled-job history;
- model and calculation registry;
- active configuration versions;
- user-role and unit assignments;
- API and Function errors;
- audit-log availability;
- prominent synthetic-data status.

#### Permitted administrator actions

The administrator may:

- manage role and unit mappings;
- retry failed technical jobs;
- configure alert thresholds through versioned settings;
- activate an approved calculation or model version;
- disable a malfunctioning analytical job;
- review operational logs;
- manage non-secret configuration;
- initiate approved data imports;
- correct configuration errors.

#### Administrator restrictions

The administrator cannot automatically:

- read sensitive FIR evidence;
- investigate accused persons;
- change analyst conclusions;
- close police intelligence alerts;
- alter audit records;
- silently replace a model or threshold;
- view credentials or secrets in the application interface.

Temporary support access to sensitive records requires explicit authorization and must be audited.

### Auditor or Oversight User

The auditor verifies that the platform was used responsibly. This is a read-only role.

#### What questions must the auditor answer?

1. Who viewed sensitive evidence?
2. Who created, assigned, escalated, or closed an alert?
3. Which calculation or model version created a finding?
4. Was an AI suggestion reviewed by a human?
5. Were permissions or thresholds changed?
6. Can a leadership brief be traced to evidence?
7. Were limitations and data-quality problems disclosed?

#### Audit view

The auditor may inspect:

- authentication and access events;
- sensitive-record access;
- alert lifecycle history;
- assignments and decisions;
- analyst and officer findings;
- calculation and model versions;
- threshold and configuration changes;
- generated-brief evidence references;
- data-quality warnings;
- export history.

#### Audit principle

Audit records are append-only from the application's perspective. A correction creates a new entry and never silently rewrites recorded history.

### Governance MVP boundary

The MVP does not require a complete enterprise-administration suite. It must prove role and unit mappings, job and data-quality status, analytical-version visibility, alert activity history, a read-only audit trail, and separation between administrator and auditor permissions.

## Role architecture status

The first complete role architecture is approved for:

- State Police Leadership
- Regional or Commissionerate Leadership
- District or Division Leadership
- Crime Analyst
- Station Command
- Investigating Officer
- Platform Administrator
- Auditor or Oversight User

The MVP product shape is now selected: State Leadership, District/Division Leadership, and Crime Analyst are full experiences; Station/Investigator Operations is light but working; regional scope is adaptive; governance controls are demonstrated; deferred operational expansion remains outside the core build. See [`mvp-build-contract.md`](mvp-build-contract.md).
