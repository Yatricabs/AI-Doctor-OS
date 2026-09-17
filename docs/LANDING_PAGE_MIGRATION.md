# Landing page migration

## What changed

- The GitHub repository home route (`/`) now uses the converted Next.js landing page from the ZIP project.
- The landing page keeps its external stylesheet in `styles/landing.css`; it is imported from `app/globals.css`.
- The existing GitHub home CTA behavior is preserved in the new header: `Request a free demo` opens the existing `DemoDialog`.
- The header intentionally contains only `Request a free demo` and `Sign In`; the appointment button was removed from the header to keep alignment clean. Appointment CTAs remain available in the page content.
- On mobile widths, the desktop navigation is replaced by an accessible hamburger button. Opening it reveals all navigation links plus the demo and sign-in actions.
- `Book Appointment` continues to open the landing appointment dialog through Redux.
- The existing appointment/operations experience remains available at `/demo`.

## State integration

The landing page uses the repository's existing Redux store. Its `landing` slice was added alongside the existing city, patient lookup, and API reducers; the existing store was not replaced.

## Verification

Verify the root page renders the landing UI, the header demo button opens the request dialog, the appointment dialog still opens, and `/demo` remains available after the migration. Keep generated `tsconfig.tsbuildinfo` and `test-results/` files out of commits.

## Home appointment chat

The new landing page's `Book an Appointment` buttons open the existing `PatientIntakeChat` on the same screen inside a modal. The existing adaptive reasoning, semantic consistency checks, phone lookup, edit/replay, attachments, follow-up/new-patient branch, safety handling, and final report flow are reused. The chat receives a `landing` visual variant so its patient/bot bubbles and role icons match the landing-page conversation example without changing the `/demo` chat variant.
