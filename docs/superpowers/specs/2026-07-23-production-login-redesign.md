# Production Login Redesign

## Objective

Make the Catalyst-native sign-in page look like a restrained enterprise application rather than a stretched demonstration page.

## Approved design

- Keep Catalyst embedded authentication as the only credential-handling surface.
- Use a centered 960 × 560 maximum desktop shell with a 320 px identity rail and a compact authentication panel.
- Reduce the crest, product title, and supporting copy so branding supports rather than dominates authentication.
- Limit the Catalyst form to 380 px and 300 px height; retain one sign-in heading supplied by Catalyst.
- Place the Catalyst security note directly below the form with a divider instead of at the bottom of an oversized panel.
- Preserve the Karnataka red, gold, and green top rule, Roboto typography, white surface, subtle border, and restrained shadow.
- Collapse to a compact horizontal identity header and full-width form on tablet/mobile.

## Acceptance criteria

- No invitation-only message or duplicate sign-in heading.
- Desktop shell never exceeds 960 px; form never exceeds 380 px.
- No large unused vertical region beneath the form.
- Embedded Catalyst authentication, forgot-password flow, and service redirect remain unchanged.
- The page is usable at desktop and mobile widths without overflow.
