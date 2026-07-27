# Frontend Demonstration Labels Design

## Goal

Remove the leading word `Synthetic` from user-facing names and categorical values across the frontend so dashboards read professionally, while continuing to identify non-operational results as `Demonstration data`.

## Scope

- Apply presentation-only normalization to visible workspace scope names, report values, chart labels, tables, case details, and frontend fallback report data.
- Strip only a leading, case-insensitive `Synthetic` token followed by whitespace.
- Preserve the remainder of the value unchanged.
- Keep `Demonstration data` provenance visible wherever the UI currently presents provenance.

## Non-goals

- No backend, API, seed, database, authorization, audit, or Catalyst schema changes.
- Do not mutate response objects or persisted report definitions.
- Do not remove `syntheticData`, `IsSynthetic`, provenance, or other governance fields.
- Do not alter incidental technical identifiers or CSS class names containing `synthetic`.

## Design

Create one small frontend display-value helper and use it at shared presentation boundaries. Report renderers will normalize display strings through the existing report adapter path. Workspace scope and case-detail labels will use the same helper before rendering. Frontend fallback rows may retain their current raw values because the shared rendering boundary will sanitize them.

The helper will return non-string values unchanged and will not remove embedded occurrences such as `Non-synthetic evidence`. This keeps behavior narrow and predictable.

## Testing

- Unit-test leading-token removal, case insensitivity, whitespace handling, non-string values, and embedded-word preservation.
- Add component regressions for station/district scope names and representative report/case labels.
- Run the complete frontend and repository verification suites.
- Deploy the frontend and API authorization correction already awaiting final verification.
- Exercise all five persona homepages, each persona dashboard, station report cards, report links, and browser console/error states.

## Success criteria

- No user-facing name or categorical value begins with `Synthetic` in the tested five-persona flows.
- `Demonstration data` remains visible where provenance is shown.
- All reports render without errors and existing personas/features remain functional.
