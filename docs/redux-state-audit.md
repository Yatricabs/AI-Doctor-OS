# Redux state audit

## Boundary

The project has one Redux store, mounted by `WorkspaceReduxProvider` at the doctor demo boundary (`app/demo/page.tsx`). It is a client-only store and is not persisted or hydrated from server data.

## State that belongs in Redux

- `workspace.activeNav`: the selected doctor workspace screen is shared by the shell and screen transitions and must stay synchronized with the URL `screen` query parameter.
- `workspace.selectedPatientId`: the patient detail selection is shared by the navigation shell and patient-facing workspace panels and must survive transitions between workspace screens. Only the opaque ID is stored; patient demographics, medical history, reports, bills, and AI summaries remain API-owned.

Typed actions, selectors, and hooks live in `lib/workspaceStore.ts` and `lib/reduxHooks.ts`. `workspaceNavFromQuery` and `workspaceQuery` are pure helpers so URL parsing/serialization can be checked without rendering. URL-to-store synchronization is one-way on query changes; navigation dispatches and updates the URL, while the effect only replaces the URL when the initial screen is absent, avoiding a push/replace loop.

## State intentionally kept local

- Patient appointment/intake conversation state (answers, transcript, deep-question counters, uploads, report findings, loading phases): one appointment workflow owns it, and it contains sensitive clinical content that should not be global.
- Prescription letter drafts (medicines, tests/services, quantities, prices, advice, follow-up date, print/save status): one modal owns the draft; it is not shared between screens. Saving/signing remains an API operation and does not reduce inventory stock.
- Inventory, appointment, billing, dashboard, and patient detail responses: fetched server state, not Redux cache. Screen filters, edit forms, expanded panels, and request status remain local UI state.
- Puter authentication readiness and the patient portal demo identity: owned by their existing route/component boundaries. There is no authenticated patient session contract to safely centralize.
- Theme, language, and transient dialogs: local because they are not shared across independent screens in the current product.

This keeps Redux limited to coordination state that crosses doctor-workspace boundaries, avoids duplicate stores/providers, avoids stale API caches, and minimizes globally retained patient data.
