# Catalyst Login Recovery Design

## Decision

Use invitation-only Native Catalyst Authentication. Do not expose public self-registration for a police intelligence platform. Administrators invite users, Catalyst sends the password-setup email, and confirmed users sign in through the embedded Catalyst form.

## Login experience

- Use the supplied `Karnataka-state-police.webp` crest without recolouring or distortion.
- Use locally hosted Roboto 400/500/700, matching `Design.md`; retain `Noto Sans Kannada` and system fallbacks.
- Present a calm white enterprise page with command-navy identity framing, restrained Karnataka red/yellow/green accents, and no decorative dashboard content.
- Desktop: fixed brand panel and readable authentication panel. Mobile: stacked identity and form with no horizontal overflow.
- Expand the Catalyst iframe to the complete form height and assign it an accessible title.
- State that access is invitation-only and credentials are managed by Catalyst.

## User provisioning

The current Development user `sitaramji@ksp.gov.in` is unconfirmed and cannot sign in. The first real administrator must be invited from Catalyst Authentication User Management and must complete the emailed password-setup link. Application roles and geographic scope remain server-managed; login does not grant police data access by itself.

## Acceptance criteria

- Native Catalyst email/password form is visible without nested scrolling at desktop and mobile widths.
- The iframe has a non-empty title.
- Roboto is loaded from same-origin assets with no runtime font CDN.
- The supplied crest is visible and proportionally contained.
- Empty-submit validation remains native and accessible.
- Root unauthenticated navigation still reaches the dedicated login page.
