# Test-only second-host fixture

This directory implements the design's **Test-only second host fixture**
(design.md, section "Test-only second host fixture") for the clinical report
renderer host-equivalence verification.

`host-adapter.tsx` exposes two adapters with the **same public host adapter
shape** as the production primary host (`components/workspace/PatientsScreen.tsx`
and `AIResponse.tsx`, which render `ClinicalReportRenderer` with an `ir` and an
optional `className`):

- `PrimaryHostAdapter` — a thin wrapper that renders `ClinicalReportRenderer` the
  way the primary host does, so both hosts can be driven identically.
- `SecondHostAdapter` — the same renderer inside a **minimal alternate layout
  wrapper/theme** (a different wrapper element and `className`). Its only
  intentional difference is layout/theme.

Both adapters:

- receive a **prebuilt `ClinicalReportIR`** plus presentation options,
- render the **same `ClinicalReportRenderer`**,
- register **no** fetcher, generator, patient-workflow state, route-derived
  policy, or clinical classifier,
- do **not** infer safe-link policy/context (that is supplied explicitly at the
  parser boundary, before the IR exists).

## Isolation guarantees

- This fixture is **test-only** and is **excluded from production exports and
  application bundles**. No production module imports it; it is imported only by
  `tests/clinical-report-renderer/host-equivalence.spec.ts` and the node
  contract script `scripts/clinical-report-renderer-contract-tests.mjs`.
- The alternate layout/theme changes layout only; it never changes semantic
  content, hierarchy, citations, links, source order, explicit priorities, or
  state behavior. `host-equivalence.spec.ts` asserts this equivalence.
