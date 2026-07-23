# ACE Tenant Branding Design

## Product and tenant model

ACE is the reusable platform product. Each police organization operates a branded tenant instance, following the same separation used by enterprise platforms: product identity remains stable while organization identity, abbreviation, logo and presentation preferences belong to the tenant.

The current tenant defaults are:

- Product name: `ACE`
- Instance name: `KSP ACE`
- Organization name: `Karnataka State Police`
- Organization abbreviation: `KSP`
- Product expansion: `Analytics · Crime · Enforcement`
- Product expansion visible: `true`
- Organization logo and government seal: existing bundled KSP assets
- Browser title: `KSP ACE | Karnataka State Police`

## Visual hierarchy

Application headers use the approved hierarchy:

1. KSP logo
2. `Karnataka State Police`
3. `Analytics · Crime · Enforcement`

`KSP ACE` is the instance/application name, but it does not replace the organization-first hierarchy in compact operational headers. Login, loading, document title and appropriate product-reference surfaces may display the instance name.

## Architecture

Create one frontend branding boundary with immutable bundled defaults and an optional runtime override. Components read branding through a provider/hook rather than embedding KSP strings or asset paths.

The initial release uses bundled defaults and performs no new network request. The resolver accepts a validated runtime override supplied through `window.__ACE_BRAND__`. A future Catalyst bootstrap endpoint can populate the same object from tenant administration without changing consuming components.

The configuration includes only presentation-safe fields:

- `productName`
- `instanceName`
- `organizationName`
- `organizationShortName`
- `productTagline`
- `showProductTagline`
- `organizationLogo`
- `governmentSeal`
- `documentTitle`

Unknown fields are ignored. Missing or invalid values fall back independently to bundled defaults so authentication and loading screens remain branded even when runtime configuration is unavailable.

## Component coverage

The shared branding source supplies:

- login identity panel and embedded-auth frame title;
- startup/loading identity;
- workspace selector header;
- operational platform header;
- reusable organization-brand component;
- Command Centre header;
- browser document title and image alternative text.

Internal authorization roles, Catalyst access profiles, API contracts and crime-intelligence terminology are not renamed.

## Future Catalyst administration

A later platform-administration phase can store one active branding record per tenant in Catalyst Data Store, keep uploaded assets in Stratus, expose a presentation-safe bootstrap response, and cache it. That phase writes the same runtime contract consumed here; no component-level refactor is required. Tenant administrators may disable the ACE expansion by setting `showProductTagline=false` while retaining the product identity and accessibility labels.

## Verification

- Unit tests validate defaults, partial runtime overrides and invalid-value fallback.
- Component tests prove headers use organization-first hierarchy and contain no hard-coded legacy product name.
- Existing authentication, workspace, Command Centre and routing tests remain green.
- The complete frontend test suite and production build pass.
- Browser verification confirms the canonical Catalyst URL displays the approved hierarchy and document title.

