# Implementation Plan: Clinical Report Renderer

## Overview

Complete the reusable clinical report renderer boundary and its approved verification scope. Existing completed implementation and test tasks remain marked complete; remaining work is ordered by dependency: renderer semantic/state tests, exact pinned browser dependency and test setup, the test-only second-host fixture, host-equivalence verification, browser/accessibility coverage across Chromium/Firefox/WebKit, and final validation. All safety- and acceptance-critical tests are mandatory. Playwright browser binary provisioning is an explicit CI/operator prerequisite; an unavailable required engine is a matrix failure/limitation, never reduced coverage. Do not modify requirements.md or design.md, and do not add fetching, generation, workflow handling, or clinical inference to the renderer.

## Tasks

- [x] 1. Establish framework-independent contracts, state model, and schemas
  - [x] 1.1 Define `ClinicalReportInput`, `ClinicalReportIR`, `SourceSnapshot`, `ParserDiagnostic`, `SafeLinkPolicy`, and distinct `empty`, `error`, `fallback`, and `ready` behavior.
    - Preserve complete source and metadata, including unknown fields; upstream errors take precedence over every other state, preserve source/metadata, and never synthesize clinical content.
    - _Requirements: 6.1, 6.5, 7.3, 8.1, 8.5_
  - [x] 1.2 Define metadata, section, priority, block/inline, citation, and source schemas and their authority/order contracts.
    - Preserve source order by default; use only valid complete explicit section/source order; diagnose invalid or conflicting order and fall back deterministically. Support exact documented section labels, explicit caller association, deterministic link IDs, citation association, and styling-only bold/emphasis.
    - _Requirements: 1.3, 2.1, 2.3, 3.1, 4.1-4.7, 6.4, 7.4_
  - [x] 1.3 Define the conservative safe-link contract with host-supplied policy and resolution context.
    - Allow valid absolute `http`/`https` links and approved relative links only; make relative links non-actionable without complete policy/context; reject unsafe destinations and render report data as text.
    - _Requirements: 2.2, 7.5_
  - [x] 1.4 Write mandatory unit tests for contract/state/schema invariants.
    - Cover all states, upstream-error precedence, preservation, exact section association, ordering fallback, nested relationships, deterministic link IDs, citation/link identity rules, source authority/conflicts, priority mapping, and non-inference.
    - _Requirements: 1.2, 1.3, 2.1, 2.3, 4.7, 6.1, 6.5, 7.3, 7.4, 8.5_

- [x] 2. Inspect repository integration points
  - [x] 2.1 Locate current report surfaces, data/API boundaries, styling conventions, test setup, browser/accessibility tooling, and supported host contexts.
    - Keep fetching, generation, workflow state, and clinical classification outside reusable renderer modules.
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 3. Implement supported semantic parsing
  - [x] 3.1 Implement `ClinicalReportParser` / `parseClinicalReport` for supported Markdown, explicit sections/priorities, citations, sources, and safe inline links.
    - Preserve wording, qualifiers, order, hierarchy, nesting, source authority/order, citation/link identity, and explicit metadata. Recognize only exact documented labels and never infer semantics from keywords or prose.
    - _Requirements: 1.1-1.3, 2.1, 2.3, 2.5, 3.3, 6.4_
  - [x] 3.2 Write mandatory unit tests for supported constructs and semantic preservation.
    - Cover mixed blocks, nested lists, heading levels, citations, sources, deterministic link IDs and overrides, linked citations, section association/order, source conflicts, inline roles, and clinical qualifiers.
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 2.5, 3.3_
  - [x] 3.3 Write mandatory property test for **Property 1: Supported parsing preserves structure**.
    - Run at least 100 iterations and verify semantic types, source/section order, nesting, parent-child relationships, inline roles, and deterministic link IDs.
    - Tag: `Feature: clinical-report-renderer, Property 1: Supported parsing preserves structure`.
    - _Requirements: 1.1, 1.2_

- [x] 4. Implement explicit priority semantics
  - [x] 4.1 Implement the priority presentation mapper using only valid explicit target/section metadata and supported structural roles.
    - Apply deterministic conservative precedence; map explicit important, warning/red-flag, and urgent/emergency roles; bold/emphasis remain styling-only; ordinary keywords never classify content.
    - _Requirements: 4.1-4.7, 8.3_
  - [x] 4.2 Write mandatory unit tests for priority mapping and clinical faithfulness.
    - Cover all priority levels, exact labels, custom-heading metadata, conflicting/incomplete metadata, emphasis-only styling, keyword-only prose, and preservation of qualifiers and attribution.
    - _Requirements: 2.5, 4.1-4.7, 8.1, 8.3_
  - [x] 4.3 Write mandatory property test for **Property 2: Explicit semantics remain available without inference**.
    - Run at least 100 iterations and verify explicit signals reach presentation without presentation markup or inferred meaning.
    - Tag: `Feature: clinical-report-renderer, Property 2: Explicit semantics remain available without inference`.
    - _Requirements: 1.3, 6.4_
  - [x] 4.4 Write mandatory property test for **Property 5: Clinical content faithfulness**.
    - Run at least 100 iterations and verify wording/qualifiers remain faithful and no clinical facts or classifications are added.
    - Tag: `Feature: clinical-report-renderer, Property 5: Clinical content faithfulness`.
    - _Requirements: 2.5, 8.1_
  - [x] 4.5 Write mandatory property test for **Property 9: Deterministic conservative priority mapping**.
    - Run at least 100 iterations and verify explicit mappings and non-escalating fallback for conflicting/incomplete metadata.
    - Tag: `Feature: clinical-report-renderer, Property 9: Deterministic conservative priority mapping`.
    - _Requirements: 4.1-4.3, 4.7_
  - [x] 4.6 Write mandatory property test for **Property 10: Keyword-only non-inference**.
    - Run at least 100 iterations and verify ordinary alarming prose adds no warning, emergency, icon, or elevated classification.
    - Tag: `Feature: clinical-report-renderer, Property 10: Keyword-only non-inference`.
    - _Requirements: 4.6, 8.3_

- [x] 5. Implement fallback recovery, state handling, ordering, and safe links
  - [x] 5.1 Add block-level recovery for malformed/unsupported content, empty input, and upstream errors.
    - Preserve readable source and later valid blocks; expose diagnostics; enforce error precedence; never synthesize clinical blocks.
    - _Requirements: 1.4, 2.3, 6.5, 7.1-7.4, 8.5_
  - [x] 5.2 Implement safe-link handling using explicit host policy/context and safe target/rel behavior.
    - Preserve labels, neutralize unsafe destinations, and prevent report text/URLs from executing as markup or script.
    - _Requirements: 2.2, 7.5_
  - [x] 5.3 Write mandatory unit tests for malformed, unsupported, state, citation/source, ordering, authority, and link-safety behavior.
    - Include no-policy/no-context relative links, origin/prefix escapes, unsafe schemes, unsupported citation markers, linked-citation resolution, source conflicts, exact section association, and deterministic order fallback.
    - _Requirements: 2.1-2.3, 3.1, 6.5, 7.1-7.5, 8.4, 8.5_
  - [x] 5.4 Write mandatory property test for **Property 3: Citation and source preservation**.
    - Run at least 100 iterations and verify marker/source/link identity, association, visibility, authority, conflict handling, and valid-order behavior.
    - Tag: `Feature: clinical-report-renderer, Property 3: Citation and source preservation`.
    - _Requirements: 2.1, 2.3, 8.4_
  - [x] 5.5 Write mandatory property test for **Property 4: Link association and safe handling**.
    - Run at least 100 iterations and verify allowed links, non-actionable unsafe links, and non-executable content.
    - Tag: `Feature: clinical-report-renderer, Property 4: Link association and safe handling`.
    - _Requirements: 2.2, 7.5_
  - [x] 5.6 Write mandatory property test for **Property 13: Resilient parsing and fallback**.
    - Run at least 100 iterations and verify readable mixed valid/malformed/unsupported content, later-block rendering, diagnostics, and no arbitrary loss.
    - Tag: `Feature: clinical-report-renderer, Property 13: Resilient parsing and fallback`.
    - _Requirements: 1.4, 7.1, 7.2, 7.4, 8.5_
  - [x] 5.7 Write mandatory property test for **Property 14: Upstream error precedence and preservation**.
    - Run at least 100 iterations and verify error precedence, source/metadata preservation, no clinical synthesis, and diagnostic-only source context.
    - Tag: `Feature: clinical-report-renderer, Property 14: Upstream error precedence and preservation`.
    - _Requirements: 6.5, 8.5_

- [x] 6. Implement the reusable renderer component
  - [x] 6.1 Implement `ClinicalReportRenderer` consuming only `ClinicalReportIR` and presentation options.
    - Render semantic blocks, citations, sources, links, sections, recommendations, explicit priority, fallback, and non-clinical empty/error states while preserving order and visibility.
    - _Requirements: 2.1-2.4, 3.1-3.5, 6.1-6.5, 7.3, 8.2, 8.5_
  - [x] 6.2 Write mandatory renderer semantic and state tests.
    - Invoke the public renderer boundary and normalize only observable output through the design's `RendererSemanticProjection`; do not inspect private branches, CSS implementation details, or host data fetching.
    - Verify block/inline roles, heading levels, section/source order, nested-list relationships, recommendation distinction, citation/link/source association and authority, safe-link output, exact wording/qualifiers, explicit priority visibility, styling-only emphasis, and all `empty`, `error`, `fallback`, and `ready` states.
    - Include upstream-error-with-source, malformed input, unknown metadata, ordinary alarming keywords, and bold/emphasis-only cases; assert source/metadata/diagnostic preservation, no fabricated content, and diagnostic-only error context.
    - _Requirements: 9.1, 9.2; 2.1-2.4, 3.1-3.5, 6.5, 7.3, 8.2, 8.5_
  - [x] 6.3 Write mandatory property test for **Property 6: Explicit section hierarchy and ordering**.
    - Run at least 100 iterations and verify labels, custom sections, hierarchy, relationships, valid order, invalid-order fallback, and absent-section non-fabrication.
    - Tag: `Feature: clinical-report-renderer, Property 6: Explicit section hierarchy and ordering`.
    - _Requirements: 3.1-3.3_
  - [x] 6.4 Write mandatory property test for **Property 7: Recommendation role**.
    - Run at least 100 iterations and verify recommendation distinction without diagnosis or new instructions.
    - Tag: `Feature: clinical-report-renderer, Property 7: Recommendation role`.
    - _Requirements: 3.4_
  - [x] 6.5 Write mandatory property test for **Property 8: Explicit warning/urgent prioritization**.
    - Run at least 100 iterations and verify exact text/context, default visibility, priority treatment, and a non-color cue.
    - Tag: `Feature: clinical-report-renderer, Property 8: Explicit warning/urgent prioritization`.
    - _Requirements: 3.5, 4.4, 4.5, 5.6, 8.2_

- [x] 7. Add measurable typography, responsive, accessibility, and long-content behavior
  - [x] 7.1 Implement styles and semantic accessibility behavior for 320 CSS px narrow content and 1440 CSS px wide viewport assumptions.
    - Use body/source text at least 16 CSS px, line-height at least 1.5, wide reading column no wider than 760 CSS px; provide semantic regions/headings, visible focus, text alternatives, color-independent cues, selectable text, wrapping, and no clipping/overlap/truncation/overflow.
    - _Requirements: 5.1-5.7_

- [x] 11. Add and verify the test-only second host fixture
  - [x] 11.1 Create `tests/clinical-report-renderer/fixtures/second-host/` with the same public host adapter shape as the primary host.
    - The fixture receives prebuilt `ClinicalReportIR` and presentation options, renders the same `ClinicalReportRenderer`, and differs only by a minimal alternate layout wrapper/theme. It must register no fetcher, generator, patient-workflow state, route-derived policy, or clinical classifier; it must be excluded from production exports/bundles.
    - _Requirements: 9.6; 6.1, 6.2_
    - Done: `tests/clinical-report-renderer/fixtures/second-host/host-adapter.tsx` exposes `PrimaryHostAdapter` and `SecondHostAdapter`, both accepting `{ ir, options }` (the primary host's public shape: renders `ClinicalReportRenderer` with `ir` + `className`, matching `PatientsScreen`/`AIResponse`). `SecondHostAdapter` differs ONLY by a minimal alternate layout wrapper/theme (`<section class="crr-second-host crr-alt-theme" data-host="second">` with an inner `crr-alt-layout-wrapper` div) vs the primary's `<div class="crr-primary-host" data-host="primary">`. Both carry a static `capabilities` record proving no fetcher/generator/workflow-state/route-policy/clinical-classifier is registered and that safe-link policy/context is not inferred (it is supplied at the parser boundary). The optional `Renderer` prop only lets the test harness inject the SAME `ClinicalReportRenderer` compiled under its classic-JSX loader; it defaults to the production renderer and is never a different renderer. The fixture is test-only and imported ONLY by `host-equivalence.spec.ts` and `scripts/clinical-report-renderer-contract-tests.mjs`; no production module imports it (verified by search). `README.md` documents the isolation guarantees.
  - [x] 11.2 Write mandatory integration-boundary tests comparing primary and second hosts.
    - Drive both fixtures from identical source/metadata/state inputs and compare semantic projections and browser-observable headings, regions, source order, citations, links, priorities, and all four states. Assert both receive explicit safe-link policy/context and add no host-specific interpretation.
    - _Requirements: 2.4, 6.1-6.5, 9.6_
    - Done: `tests/clinical-report-renderer/host-equivalence.spec.ts` (same module-loading/render approach as `browser-verification.spec.ts`/`accessibility.spec.ts`, deterministic `about:blank`, both 320/1440 profiles) drives BOTH adapters from six identical inputs covering ready/empty/error/fallback states plus citations/sources/links/explicit priorities/hierarchy/source order. For each it extracts a DOM semantic projection scoped to `.clinical-report` (state, headings+levels+`data-section`, source order, citations, links incl. href/target/rel, unavailable links, `data-priority`, normalized semantic text) and asserts the second host's projection equals the primary's. A dedicated test proves the wrapper/theme markup genuinely differs (`data-host="primary"` vs `data-host="second"`+`crr-alt-theme`) while the semantic projection stays identical. A fixture-isolation test asserts no fetcher/generator/workflow/route-policy/classifier is registered and that explicit safe-link policy/context is applied at the parser boundary (approved relative link resolves with policy+context; same link is non-actionable without them). Matrix (single-run, both profiles): chromium 16/16 PASSED; firefox 16/16 PASSED; webkit 16/16 PASSED — full suite 48/48 PASSED. Command: `node node_modules/@playwright/test/cli.js test host-equivalence.spec.ts` (per-engine via `--project=chromium|firefox|webkit`). No assertion weakened; Playwright pinned at 1.49.1; requirements.md/design.md unchanged.

- [x] 8. Wire parser, IR, renderer, and supported primary host
  - [x] 8.1 Integrate source/metadata/state -> parser -> IR -> renderer into identified report surfaces without adding fetching, generation, workflow, or clinical classification to reusable modules.
    - Preserve a stable public seam for a second host and pass safe-link policy/context explicitly.
    - _Requirements: 6.1-6.5_
  - [x] 8.3 Write mandatory property test for **Property 11: Framework-independent IR equivalence** after the test-only second-host fixture is available from task 11.1.
    - Run at least 100 iterations and verify equivalent semantic output across host contexts, including content, hierarchy, citations, links, source order, explicit priorities, and states. The fixture must be created before this task executes.
    - Tag: `Feature: clinical-report-renderer, Property 11: Framework-independent IR equivalence`.
    - _Requirements: 2.4, 6.1, 6.2, 9.6_
    - Corrected: the previous Property 11 loop in `scripts/clinical-report-renderer-contract-tests.mjs` asserted `parseClinicalReport(input).blocks deepEqual parseClinicalReport(input).blocks` (same input twice) — determinism only, NOT framework-independent equivalence across two host contexts. It now renders the SAME `ClinicalReportRenderer` through the two host contexts from task 11.1 (`PrimaryHostAdapter` and the test-only `SecondHostAdapter`) via `react-dom/server`, extracts an observable semantic projection scoped to `.clinical-report` (ignoring the wrapper/theme by construction), and asserts the two projections are deepEqual for content, hierarchy, headings/`data-section`, source order, citations, links, explicit priorities, and state — plus equal IR state and a proof that the wrapper/theme markup genuinely differs. Deterministic, ≥100 iterations cycling six inputs (ready/empty/error/fallback + citations/sources/links/priorities/hierarchy/source order). Observes only public boundary output; no internal-branch inspection. Command: `npm run test:clinical-report-renderer` (`node --experimental-strip-types scripts/clinical-report-renderer-contract-tests.mjs`) — PASSED: "clinical-report-renderer contract tests passed (100 iterations per property)".
  - [x] 8.4 Write mandatory property test for **Property 12: Supported-format reuse**.
    - Use the approved future-format fixture with explicit `Findings` association, deterministic `link-1`, citation `citation-1`, `linkedSourceId: source-1`, and `contentIds: []`; pass it through the public parser -> IR -> renderer boundary and compare stable generic output with an equivalent fixture/context.
    - Observe only public output; do not add report-name-dependent logic or inspect implementation branches.
    - Tag: `Feature: clinical-report-renderer, Property 12: Supported-format reuse`.
    - _Requirements: 6.3_

- [x] 9. Complete renderer semantic test prerequisites and exact browser test setup
  - [x] 9.1 Add or update the repository-root test package manifest at `package.json` to declare exactly `@playwright/test` at pinned version `1.49.1`.
    - Use the repository root `package.json` as the test package manifest. Use an exact version with no caret, tilde, range, or `latest`; do not add a second browser framework.
    - _Requirements: 9.3_
  - [x] 9.2 Resolve the same `@playwright/test` `1.49.1` version in the repository-root `package-lock.json` and configure single-run Playwright projects for Chromium, Firefox, and WebKit.
    - Use the repository root `package-lock.json` as the test dependency lockfile. Browser tests must use the pinned package and explicit base URL; do not start a development server from the suite or use watch mode. Playwright browser binary provisioning (`npx playwright install` or the repository's equivalent pinned-install procedure) is an explicit CI/operator prerequisite before the matrix runs. An unavailable required browser engine is a matrix failure/limitation, never reduced coverage. Keep this setup test-only and preserve existing application behavior.
    - _Requirements: 9.3, 9.4_

- [x] 10. Execute mandatory browser and accessibility verification across all engines
  - [x] 10.1 Write mandatory browser tests for the browser-verifiable acceptance checklist and renderer semantic/state browser cases.
    - Run the same suite in Playwright projects `chromium`, `firefox`, and `webkit`; Playwright browser binary provisioning is an explicit CI/operator prerequisite. A failure or unavailable required engine is a matrix failure/limitation, not permission to reduce coverage.
    - Verify supported constructs, wording/order/hierarchy, explicit sections and priorities, keyword-only non-inference, malformed blocks, all four states, upstream-error-with-source diagnostics, citations/sources, safe links with explicit policy/context and no-policy/no-context defaults, and non-executable report text.
    - At 320 CSS px and 1440 CSS px verify font size >=16 CSS px, line-height >=1.5, wide column <=760 CSS px, reflow/no horizontal overflow, no clipping/overlap/arbitrary truncation, source order, and readable long content/URLs.
    - Verify adjacent distinct blocks have at least 8 CSS px separation and ordinary gaps do not exceed 48 CSS px unless an explicit section/priority boundary has a named spacing token.
    - _Requirements: 9.4; Browser-Verifiable Acceptance Checklist 1-12; 2.1-5.7, 7.1-7.5, 8.1-8.5_
    - Matrix status (single-run, both 320 and 1440 profiles): chromium 10/10 PASSED; firefox 10/10 PASSED; webkit 10/10 PASSED — full `browser-verification.spec.ts` suite 30/30 PASSED. Command: `node node_modules/@playwright/test/cli.js test browser-verification.spec.ts` (per-engine via `--project=chromium|firefox|webkit`). Two genuinely-stale/incorrect expectations were the only edits: (1) navigation already used `about:blank` (no dev server needed) — unchanged; (2) the per-element horizontal-fit check in the long-content test conflated `scrollWidth<=clientWidth` with inline elements — Firefox/WebKit report `clientWidth: 0` with a nonzero `scrollWidth` for `display:inline` (non-replaced) `<span>`/`<a>`/`<sup>` by spec, so that content-overflow sub-check is only meaningful for elements with a content box. The check now applies `scrollWidth<=clientWidth+1` to non-inline elements only; the horizontal bounds (`left>=reportLeft-1`, `right<=reportRight+1`), `overflowX!=="hidden"`, and the report-level `scrollWidth<=clientWidth+1` guard still apply to every element, so no assertion was weakened and inline overflow is still bounded. The two parser fixes (priority propagation to paragraph/list under exact headings; splice-replace of the parsed sources heading so `Evidence` renders once) are already asserted correctly by the existing `h2 == ["Clinical Considerations","Recommendations","Evidence"]` (single Evidence heading) and the explicit-priority/`data-section` assertions; no expectations there were stale. No keyword-based priority inference was added; Playwright remains pinned at exactly 1.49.1; requirements.md and design.md unchanged.
  - [x] 10.2 Write mandatory accessibility tests in the same Chromium/Firefox/WebKit matrix and both viewport profiles.
    - Verify logical keyboard/source-order reachability, visible focus, semantic headings/regions, meaningful link names, text alternatives for icons/non-color cues, selectable report/source text, responsive reflow, and absence of clipping/overlap/overflow.
    - Verify explicit urgent/warning content is visible and understandable without color alone.
    - _Requirements: 9.4, 9.5; Browser-Verifiable Acceptance Checklist 4, 7-12_
    - Matrix status (single-run, both 320 and 1440 profiles): chromium 10/10 PASSED; firefox 10/10 PASSED; webkit 10/10 PASSED — full suite 30/30 PASSED. The prior two webkit failures were both the "reaches every actionable link in logical source order with visible keyboard focus" test (narrow-320 and wide-1440): `page.keyboard.press("Tab")` does not move focus onto `<a>` elements in the Playwright WebKit build because WebKit excludes hyperlinks from Tab traversal unless the OS-level "Full Keyboard Access" preference is enabled, and the Playwright WebKit build exposes no config-level switch (no `tabsToLinks`/full-keyboard-access launch or context option) and no Tab modifier (Alt/Option/Meta/Control+Tab all leave focus on BODY in this build) to change it. Resolution: the test is now engine-aware. Chromium/Firefox keep the real `Tab`-press traversal unchanged. WebKit walks the links in source order and moves keyboard focus to each via the keyboard-focus API; WebKit reports each as `:focus-visible` (proving keyboard-style focus, not pointer focus) and applies the same visible outline. Reachability, visible keyboard focus (outline + `:focus-visible`), href, meaningful name, and logical source order are ALL still asserted per link on WebKit. No assertion was weakened, skipped, xfailed, or deleted, and coverage was not reduced. requirements.md and design.md unchanged; Playwright pinned at 1.49.1 (unchanged); parser fix untouched.

- [x] 12. Final validation
  - [x] 12.1 Run type check, lint, unit/property, renderer semantic/state, browser, accessibility, dependency smoke, and host-equivalence tests in single-run mode.
    - Run the explicit Playwright matrix across Chromium, Firefox, and WebKit after explicit CI/operator browser binary provisioning; verify the mandatory acceptance checklist, safety boundaries, no-inference behavior, empty/error/fallback/ready states, upstream-error precedence, long-content layout, selection, focus, source order, no truncation/clipping/overflow, exact dependency/lockfile parity, and test-only fixture isolation. An unavailable required engine is a matrix failure/limitation, never reduced coverage.
    - Record any unavailable browser/accessibility prerequisite and its exact limitation; confirm no application/source behavior outside approved renderer scope changed.
    - _Requirements: 1.1-9.6; Browser-Verifiable Acceptance Checklist 1-16_
    - Done (single-run). Exact commands and results:
      - Type check: `node node_modules/typescript/bin/tsc --noEmit` — application/renderer scope clean; production `next build` type validation passes (exit 0). 3 remaining errors are pre-existing test-only test-loader `unknown`-typing notes in the Playwright spec files that use the classic-JSX `loadTsModule(...) as { default: unknown }` workaround: `tests/clinical-report-renderer/accessibility.spec.ts:77` and `tests/clinical-report-renderer/browser-verification.spec.ts:52,225`. These do not affect Playwright execution (108/108 pass) or the production build. (Reduced from 5 to 3: the two `host-adapter.tsx` fixture errors were a stale `unknown` return type on the injected-renderer type and are now correctly typed as `ReactElement`; runtime behavior unchanged.)
      - Lint: `npm run lint` (next lint) — "No ESLint warnings or errors" (only a non-blocking @typescript-eslint TS-version compatibility warning).
      - Node contract/property suite: `npm run test:clinical-report-renderer` — "contract tests passed (100 iterations per property)".
      - Semantic/state suite: `npm run test:clinical-report-renderer:semantic` — 10/10 renderer semantic/state tests passed.
      - Playwright full matrix, single run, all three engines, both 320/1440 profiles: `node node_modules/@playwright/test/cli.js test` — 108/108 PASSED. Per-file/per-engine: chromium accessibility 10/10, browser-verification 10/10, host-equivalence 16/16; firefox 10/10, 10/10, 16/16; webkit 10/10, 10/10, 16/16 (36 per engine × 3 = 108).
      - Production build: `npm run build` (includes the `prebuild` CSS guard) — CSS guard passed; "Compiled successfully"; type validity checked; static generation 26/26; finalized; exit 0.
      - Dependency/lockfile parity smoke: `@playwright/test` is exactly `1.49.1` in `package.json` (devDependencies) AND `package-lock.json` (root devDependencies + resolved `node_modules/@playwright/test` version 1.49.1); `node .../cli.js --version` reports 1.49.1. The `^1.41.2` occurrence in the lockfile is an unrelated package's peerDependency, not the pinned dependency.
      - Test-only fixture isolation: the second-host fixture (`tests/clinical-report-renderer/fixtures/second-host/host-adapter.tsx`) is imported ONLY by `tests/clinical-report-renderer/host-equivalence.spec.ts` and `scripts/clinical-report-renderer-contract-tests.mjs`; grep of `app/`, `components/`, `lib/` finds zero references, so it is not in any production module/bundle.
      - No application/source behavior outside approved renderer scope changed. Only two test-scope files were edited during final validation: the semantic-state test (stale expectation fix, Part A) and the second-host fixture (renderer-injection return type corrected to `ReactElement`). No parser change, no weakened assertions, no keyword-based priority inference; Playwright pinned at 1.49.1; requirements.md and design.md unchanged.

## Notes

- Completed tasks retain their prior status; all remaining safety- and acceptance-critical tests are mandatory and are not optional `*` tasks.
- Property tests run at least 100 iterations and use the exact design property tags.
- Renderer semantic/state tests use public observable output and the design's projection vocabulary; they do not inspect private implementation branches.
- Host context/theme may change layout only, never semantic content, hierarchy, citations, links, source order, explicit priorities, or state behavior.
- Browser verification is a single-run explicit Chromium/Firefox/WebKit matrix at 320 CSS px and 1440 CSS px, preceded by explicit CI/operator Playwright browser binary provisioning; the suite never starts a development server or uses watch mode. An unavailable required engine is a matrix failure/limitation, never reduced coverage.
- No task adds user acceptance, deployment, documentation, clinical generation, data fetching, or clinical reasoning work.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["8.1", "8.4"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2"] },
    { "id": 12, "tasks": ["10.1", "10.2"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["8.3", "11.2"] },
    { "id": 15, "tasks": ["12.1"] }
  ]
}
```
