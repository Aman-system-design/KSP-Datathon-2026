# Deferred Signal and Operational Expansion

**Product:** KSP Crime Decision Intelligence Platform  
**Status:** Approved architecture direction; deferred until the Challenge 02 core is working  
**Purpose:** Preserve valuable future capabilities without allowing them to dilute the crime-analytics MVP

## Architectural position

The product's centre remains the Crime Analytics Engine. Role-specific dashboards, the Command Centre, CCTV alerts, public/social signals, and major-event priorities are channels and context around that engine; they are not substitutes for hotspot detection, anomaly detection, link analysis, repeat-offender tracking, district correlation, area-risk scoring, or AI/ML pattern detection.

The expansion may begin only after the MVP can demonstrate this evidence-backed flow:

**fragmented FIR records -> validation and linking -> crime analytics -> explainable alert -> geographic drilldown -> human verification -> assignment -> recorded outcome**

## Future signal sources

### CCTV-derived alerts

The platform may receive alert metadata from an authorized CCTV or video-analytics system. A signal can include camera identifier, detection type, event time, location, confidence, media reference, source-system identifier, and review status.

The crime platform will not treat a machine-generated CCTV alert as a confirmed offence. An authorized user must review it, and the original signal, human finding, and subsequent action remain separately identifiable.

### Public and social-media signals

Authorized ingestion may surface publicly reported incidents such as dangerous driving or vehicle stunts. Each signal must retain its source reference, collection time, event time, location, media reference, credibility or verification status, and legal or retention restrictions.

The platform must not perform unrestricted surveillance, infer guilt from a post, or treat online popularity as operational priority. Production integration requires KSP approval, platform terms compliance, lawful collection, retention rules, and human verification.

### Major events and state priorities

Authorized users may record planned priorities such as high-security visits, festivals, rallies, sporting events, or other major gatherings. A priority can include owning unit, time window, geographic footprint, sensitivity classification, operational status, and links to relevant intelligence.

These records provide context for interpreting risk and allocating attention. They do not independently create a crime prediction.

## Future experience surfaces

### Command Centre presentation mode

The Command Centre is a large-screen, authenticated presentation mode within the same platform. It may display:

- statewide and city intelligence maps;
- emerging hotspots, anomalies, and cross-jurisdiction patterns;
- prioritized CCTV and verified public signals;
- major-event priorities;
- alert ownership and response status;
- data and analytics freshness.

It is designed for rapid shared awareness, not detailed investigation or unrestricted case access. Personally identifiable and sensitive case information remains masked unless a separately authorized user opens it on an appropriate workstation.

### Leadership desktop expansion

State, regional, commissionerate, district, and division leaders may later receive additional operational context such as net new cases, case-ageing buckets, subordinate-unit response status, upcoming priorities, and major-incident highlights. The configured unit hierarchy determines scope; separate applications for each rank are not required.

### Station and officer expansion

Station command may later receive total active cases, case ageing, local CCTV signals, assigned actions, and local response status. Other officers receive only authorized alerts, cases, and tasks. Investigating officers may use a responsive tablet experience for assigned verification, evidence review, structured findings, and attachments.

## Shared processing flow

External signals and operational priorities enter through governed connectors or approved manual capture. The platform validates provenance, time, location, permissions, and media references before linking a signal to an analytical finding or workflow record.

A future signal follows this lifecycle:

1. received;
2. validated;
3. triaged;
4. correlated with authorized crime intelligence;
5. reviewed by a human;
6. assigned or dismissed with a reason;
7. closed with an outcome and audit history.

Signals never overwrite FIR records or original analytical findings.

## Catalyst service direction

When implemented, use Catalyst-native services where they match the requirement:

- Catalyst Functions for validation, correlation, and backend logic;
- Catalyst API Gateway for governed connector and application APIs;
- Catalyst Data Store for structured signal, priority, status, and audit records;
- Catalyst Stratus for approved media or larger evidence objects;
- Catalyst Zia Services for supported image/video analysis where suitable;
- Catalyst Signals and Event Functions for event-driven processing;
- Catalyst Authentication for role and unit-aware access;
- Catalyst Slate or Web Client Hosting for desktop, Command Centre, and responsive tablet experiences.

## MVP exclusion and entry criteria

The hackathon MVP may use, at most, one clearly synthetic CCTV signal, one clearly synthetic public/social signal, and one synthetic major-event priority to demonstrate future extensibility. These examples cannot be claimed as completed production integrations.

Full implementation remains deferred until all Challenge 02 capabilities have working behavior, evidence-linked outputs, tests, role-aware access, and a complete demonstration journey. If schedule pressure exists, this expansion is removed before any Challenge 02 capability is weakened.

