# Implementation Plan

## Scope and sequencing

This plan follows the bug-condition workflow: establish the defect on unfixed code, record preservation behavior on unfixed code, implement the narrow fix, rerun the same properties, then validate the full appointment flow. Tasks are dependency-ordered; a task must not be started until its listed dependencies are complete.

**Planned touch points only:**
- `lib/clinicalPathways.ts` — pure resolver, clinical context, source-aware safety evidence, chest-specific adaptive profile, and compatible coverage/question helpers.
- `app/patient/appointment/page.tsx` — context/evidence orchestration, question metadata, adaptive deep phase, and shared final safety overlay.
- `scripts/chest-pain-pathway-matching-tests.mjs` — new pure-library and source-contract/property harness, if no existing harness is suitable.
- `scripts/appointment-adaptive-interview-tests.mjs` — extend existing adaptive coverage and page-wiring contracts where the assertions belong there.
- `.kiro/specs/chest-pain-pathway-matching/tasks.md` — this plan only in the current workflow.

Do not modify unrelated pathway data, `app/api/intake/next/route.ts`, report/persistence APIs, package files, or any coverage model outside the narrowly scoped clinical-library and appointment changes described below. Do not add a dependency or a universal questionnaire.

---

- [ ] 1. **Verification — Property 1: Bug Condition** - Reconcile the authoritative eight-phrase corpus and write the unfixed exploration test
  - **Dependency:** None. This is the required first task and must be completed before implementation work.
  - **Corpus gate (blocking):** obtain the investigation findings that contain the exact reported corpus. Create the immutable test fixture in the selected script with exactly eight non-empty, verbatim entries, preserving source order and spelling. Assert that it contains:
    - `Mere seene mein pressure aur dard ho raha hai`
    - `Seene mein dard hai`
    - `Baaye taraf seene mein dard ho raha hai`
    - the five remaining literals copied verbatim from the authoritative findings.
  - The requirements/design also mention “six currently missed phrases” while naming one observed miss and two matching examples. If the source has nine entries, omits a named entry, or otherwise disagrees with the required eight, stop and document the discrepancy; do not invent, silently deduplicate, silently omit, or normalize literals to make the count pass.
  - Add/extend the standalone exploration property in `scripts/chest-pain-pathway-matching-tests.mjs` (or the existing clinical harness if that is the repository-approved location) using the required hover format:
    - **Property 1: Bug Condition** - Chest-safety recognition and complaint-only screen boundary
  - Run this property against the **unfixed** implementation. It must intentionally fail for the known defect and document concrete counterexamples, including the generic-floor route or missing `chest_pain` match for each missed corpus phrase and complaint-only `red_flag_screen` satisfaction for `Seene mein dard hai`/`Baaye taraf seene mein dard ho raha hai`.
  - Exercise the unfixed behavior for the three named phrases, all five reconciled phrases, inserted-word variants, pressure/heaviness/burning, sudden-onset, and left-sided wording. Include standalone controls (`dard`, `pressure`, `chest`, `seene`) and non-chest chest-location controls (`seene mein khujli`, `chest rash`) to show the intended predicate is a meaningful chest-discomfort combination, not keyword presence.
  - Encode the expected post-fix assertions in the same test so it becomes the fix-checking test after implementation: every corpus/natural variant must route to `chest_pain` or a chest safety fallback, expose chest-relevant adaptive dimensions, and leave `red_flag_screen` missing when only complaint evidence exists.
  - Record the unfixed counterexamples in the test output or task notes; a failing exploration run is expected and is evidence of the original bug, not a reason to weaken the assertion.
  - `_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_`

- [ ] 2. **Verification — Property 2: Preservation** - Capture non-buggy behavior on unfixed code before implementation
  - **Dependency:** 1 (the corpus fixture and exploration scope must be resolved first).
  - Add/extend the standalone preservation property in `scripts/chest-pain-pathway-matching-tests.mjs` or `scripts/appointment-adaptive-interview-tests.mjs` using the required hover format:
    - **Property 2: Preservation** - Existing pathways, adaptive coverage, urgency, and generic fallback
  - Follow observation-first methodology: run on unfixed code, record actual pathway IDs, required dimensions, question availability, red-flag IDs/signals/urgency, and generic fallback behavior before asserting them.
  - Cover every non-chest curated pathway currently represented by the library, including cough/breathing, abdominal pain, fever, headache, urinary, back pain, rash, mental health, vomiting, and other existing IDs. Assert that valid non-chest complaints retain their pathway, adaptive required dimensions, curated questions, and red-flag semantics.
  - Cover genuinely unmatched non-chest complaints and verify they retain exactly the generic four required dimensions and do not acquire chest `relevant_history` or `red_flag_screen` requirements.
  - Cover chest-location-but-not-chest-pain controls (`chest rash`, `chest itching`, cough-only text) and standalone generic words; record that they do not falsely become `chest_pain`.
  - Preserve explicit general red flags (loss of consciousness, severe breathing difficulty, uncontrolled bleeding, very high fever/seizure, dehydration) and explicit pathway red flags, including chest radiation, sweating, breathlessness, and exertion. Assert unchanged signal text, urgency, emergency-first ordering, and duplicate behavior.
  - Assert adaptive behavior: already covered dimensions are skipped, required dimension sets vary by pathway, no fixed question count is assumed, and `MAX_DEEP` is only a ceiling—not a completion predicate.
  - Add source-contract cases for AI `STOP`, blank/failure, and duplicate-question branches to verify they fall back to the next missing dimension rather than finalizing prematurely; preserve no-diagnosis wording and existing persistence/completion contracts for non-buggy flows.
  - Verify this preservation suite passes on unfixed code before implementation and record the observed baseline. Do not change the assertions to accommodate an implementation choice.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_

- [ ] 3. Implement chest-safety routing, explicit evidence, adaptive orchestration, and shared finalization
  - **Dependency:** 1 and 2. Do not begin this parent task until the authoritative corpus is reconciled and both unfixed baselines are recorded.
  - Keep this parent task implementation-focused; its verification sub-tasks must reuse the properties from tasks 1 and 2 rather than replacing them with weaker tests.
  - `_Bug_Condition: isBugCondition(input)` when a meaningful chest-pain-equivalent complaint fails ordinary chest routing or complaint-only text satisfies `red_flag_screen` without explicit safety evidence.
  - `_Expected_Behavior: expectedBehavior(result)` routes chest-safety inputs to curated `chest_pain` or an equivalent safety-preserving fallback, keeps adaptive chest dimensions active, and requires attributable explicit safety evidence.
  - `_Preservation: Preservation Requirements` from design: unchanged non-chest pathway/fallback behavior, adaptive coverage, red-flag urgency semantics, no-diagnosis behavior, `MAX_DEEP` ceiling, AI fallback behavior, and appointment persistence.

  - [ ] 3.1 **Implementation — Pure clinical context and high-sensitivity chest resolver**
    - **Files:** `lib/clinicalPathways.ts`; the corpus remains test-only and is not copied into production vocabulary unless each literal is separately reviewed and needed.
    - Add browser-safe pure types for evidence source, safety state, chest confidence, chest safety assessment, clinical context, and source-attributed safety evidence. Use local naming conventions if equivalent separation is preserved.
    - Add `resolveClinicalContext(complaint, extra?)` (or an equivalent exported pure resolver) that first runs the existing curated matcher and then evaluates a narrow chest-safety profile. Keep `matchPathway(complaint, extra?)` exported with its existing return type and source-compatible behavior for current callers.
    - Recognize meaningful combinations of reviewed location/cardiac anchors and discomfort/quality anchors with bounded token relationships, allowing inserted modifiers/conjunctions and preserving onset/left-sided context. Support reviewed English, Roman Hindi/Hinglish, and Unicode Hindi forms for pressure, heaviness, burning, tightness, pain, and relevant variants; do not globally loosen every pathway synonym.
    - Require a meaningful location/quality combination. Standalone `chest`, `seene`, `dard`, `pain`, `pressure`, `left`, or `baaye` must not route to chest safety. Do not let non-pain chest-location complaints supersede a stronger unrelated pathway. If an explicit concurrent chest-pain meaning exists alongside another pathway, preserve the primary pathway while attaching chest safety requirements.
    - For an ordinary `null` match with `possible`/`high` chest meaning, return a `chest_safety_fallback` context with a chest-derived safety profile. A genuinely unrelated `null` remains `generic_fallback`. Preserve existing curated `chest_pain` precedence where appropriate.
    - Reuse the authoritative `chest_pain` questions/red-flag definitions rather than duplicating divergent clinical meanings. Do not infer or expose a diagnosis.
    - **Specification references:** `Bug_Condition` is a chest-equivalent complaint with route failure or unsafe screen completion; `expectedBehavior` is chest route/profile plus adaptive safety coverage; preservation requires `matchPathway` compatibility and unchanged non-chest matching.
    - _Requirements: 2.1, 2.2, 2.5, 2.7, 2.9, 3.1, 3.4_

  - [ ] 3.2 **Implementation — Source-aware red-flag evidence and adaptive coverage boundary**
    - **Files:** `lib/clinicalPathways.ts`; update only the existing clinical coverage helpers needed to accept the resolved context/evidence contract.
    - Separate complaint context from explicit safety-screen evidence. `red_flag_screen` must not be satisfied by complaint-only `chest`, `seene`, `dard`, pressure, radiation, sweating, breathlessness, left-sided, or other symptom wording.
    - Accept attributable evidence from a targeted `red_flag_screen` answer or structured safety answer, preserving `complaint`, `patient_answer`, `structured_safety_answer`, and `clinician_input` source distinctions. A clear negative targeted answer becomes `negative`; a clear affirmative answer with recognized signals becomes `positive`; missing, `pata nahi`, `shayad`, off-topic, and contradictory answers remain `unanswered`/`uncertain` and keep the dimension missing.
    - Keep `detectRedFlags` explainable and capable of seeing patient-provided context for clinician visibility and urgency, but ensure screen completion and urgency signal detection are not conflated. Preserve existing red-flag IDs, signal text, urgency values, emergency-first sorting, and duplicate merging.
    - Make `coverageFor`/`requiredDimensions` work with a context/profile so the chest fallback receives chest-relevant dimensions while unrelated unmatched complaints retain the generic four. Do not replace adaptive derivation with a universal list or fixed count. Covered onset, duration, character, severity, associated symptoms, history, and explicit safety evidence must remain skippable when actually present.
    - Ensure unresolved safety cannot be converted to a safe negative by generic answers, pathway selection, AI `STOP`, or reaching `MAX_DEEP`; expose an explicit unresolved/clinician-review-needed state for callers.
    - Preserve `MAX_DEEP` as a caller-level ceiling only; coverage completeness remains the only completion predicate.
    - _Requirements: 2.2, 2.3, 2.4, 2.8, 2.10, 3.2, 3.3, 3.5, 3.6_

  - [ ] 3.3 **Implementation — Appointment context and evidence orchestration**
    - **File:** `app/patient/appointment/page.tsx`.
    - Replace the single `pathwayRef` decision with one resolved clinical context retained for the whole intake, while preserving compatibility for existing pathway guidance and callers.
    - Resolve the complaint once when the complaint answer is captured. Pass context/profile guidance to AI deep questioning and use `questionForDimension` against the resolved chest profile for deterministic fallback questions, including when ordinary matching returned `null`.
    - Record question target metadata for each deterministic and AI deep question. Only answers attributable to a `red_flag_screen` target may become explicit safety evidence; complaint text and generic untargeted answers remain context or unresolved evidence.
    - Update coverage aggregation so all patient text can continue satisfying ordinary history dimensions, but source-aware safety evidence alone can satisfy `red_flag_screen`. Keep redundant questions avoidable, allow variable question counts, and stop only when required coverage is complete or the `MAX_DEEP` ceiling is reached.
    - Preserve AI `STOP`, blank, failure, and duplicate behavior: if coverage is incomplete, select the next missing dimension deterministically; if safety is unresolved at the ceiling, finalize with unresolved/clinician-review annotation rather than a safe pass. Do not create a universal questionnaire.
    - Keep appointment, transcript, upload, research, and patient-flow payload shapes stable except for optional safety/context metadata required to preserve unresolved evidence.
    - _Requirements: 2.2, 2.4, 2.5, 2.8, 2.9, 2.10, 3.2, 3.3, 3.6, 3.8_

  - [ ] 3.4 **Implementation — Shared deterministic final safety overlay**
    - **File:** `app/patient/appointment/page.tsx`.
    - Build one final safety evaluation from the same `ClinicalContext` and complete source-attributed evidence collection used by adaptive coverage. Do not call a second differently configured chest detector during finalization.
    - Reuse the evaluation for the intake snapshot, doctor-facing report overlay, urgency comparison, and unresolved-safety annotation. Add explainable signals without duplicates and preserve emergency-over-urgent ordering.
    - Raise AI urgency only to the worst established deterministic signal; never lower an AI urgency. Do not make complaint context alone a completed negative screen, and do not imply diagnosis from routing, red flags, urgency, or missing data.
    - Preserve appointment/report/transcript persistence for non-buggy inputs and add only optional unresolved-safety metadata required by the design.
    - _Requirements: 2.3, 2.4, 2.9, 2.10, 3.4, 3.5, 3.6, 3.8_

  - [ ] 3.5 **Verification — Property 1: Expected Behavior** - Re-run the unchanged bug-condition property after the fix
    - **Dependency:** 3.1–3.4.
    - Re-run the exact test created in task 1; do not replace it with a hand-picked subset. The authoritative eight-phrase integrity assertions must pass, including all five reconciled literals.
    - Verify every exact phrase and reviewed natural variant routes to curated `chest_pain` or `chest_safety_fallback`, receives chest-relevant adaptive dimensions, and never satisfies `red_flag_screen` from complaint context alone.
    - Verify source states: complaint-only is `unanswered`; clear negative targeted answer is `negative` and completes only the screen dimension; explicit radiation/sweating/breathlessness/exertion answers retain the established pathway/general red-flag signal and urgency; ambiguous and contradictory answers remain unresolved/uncertain.
    - Verify null ordinary chest-equivalent complaints use the chest fallback while `something feels bad` and other genuinely unrelated unmatched complaints remain generic.
    - **Expected outcome:** Property 1 passes for all corpus entries and reviewed generated variants, with no diagnostic output.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10_

  - [ ] 3.6 **Verification — Property 2: Preservation** - Re-run the unchanged preservation property after the fix
    - **Dependency:** 3.5.
    - Re-run the exact preservation suite from task 2. Compare non-chest pathway IDs, dimensions, questions, red-flag signals/urgency/order, generic fallback dimensions, no-diagnosis contracts, and persistence shape against the recorded unfixed baseline.
    - Verify explicit general and pathway red flags are neither hidden nor downgraded; ordinary chest words remain complaint context and do not become safety-screen evidence.
    - Verify adaptive behavior remains data-driven, covered dimensions remain skippable, no fixed universal question count is introduced, and `MAX_DEEP` remains a ceiling only.
    - Verify AI STOP/duplicate/blank/failure branches still choose deterministic missing-dimension questions and do not duplicate questions or prematurely finalize.
    - **Expected outcome:** Property 2 passes with no regression outside the narrowly defined chest-safety bug condition.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 3.7 **Verification — Integration** - Exercise appointment orchestration and finalization contracts
    - **Dependency:** 3.3–3.6.
    - Extend `scripts/appointment-adaptive-interview-tests.mjs` and/or add the narrowly scoped `scripts/chest-pain-pathway-matching-tests.mjs` integration contracts using the repository’s existing source-text/pure-function strategy; do not add a new runner or dependency.
    - Drive each authoritative phrase one at a time through complaint capture, context resolution, adaptive deep-question selection, explicit safety answer capture, final snapshot, deterministic overlay, and persisted report payload assertions.
    - Verify deterministic fallback questions are selected for every missing dimension after AI `STOP`, blank, failure, or duplicate output; verify the same question is not reissued and no fixed question count is assumed.
    - Verify complaint-only chest input leaves safety unresolved, clear negative/positive/ambiguous/contradictory answers preserve the correct state, and unresolved safety at `MAX_DEEP` is marked for clinician review rather than passed.
    - Verify positive radiation/sweating/breathlessness and exertion cases retain the established emergency/urgent behavior in both the snapshot and doctor-facing final report, with duplicate signal suppression and AI urgency non-downgrade.
    - Verify unrelated curated and unmatched non-chest appointment flows remain generic/adaptive and retain existing patient, appointment, transcript, report, and finalization behavior.
    - Verify no output adds diagnosis language or treats pathway selection as a diagnosis.
    - _Requirements: 2.3, 2.4, 2.8, 2.9, 2.10, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 4. **Verification — Checkpoint** - Run the complete validation set and collect acceptance evidence
  - **Dependency:** 3.1–3.7.
  - Run the focused pure/integration harnesses:
    - `node --experimental-strip-types scripts/chest-pain-pathway-matching-tests.mjs` (if created; otherwise the equivalent command for the extended existing harness).
    - `node --experimental-strip-types scripts/appointment-adaptive-interview-tests.mjs`.
    - `npm run test:appointment-adaptive-interview`.
  - Run repository validation:
    - `npm run lint`
    - `npm run build`
  - Acceptance evidence must include the exact eight-entry corpus-integrity result, the unfixed counterexamples recorded by task 1, passing Property 1 and Property 2 results, all explicit safety-state cases, general/pathway red-flag preservation, non-chest regression results, AI STOP/fallback/duplicate results, final-overlay/persistence integration results, and confirmation that no diagnosis language or fixed universal questionnaire was introduced.
  - If the authoritative corpus gate fails, stop and report the source-count/literal discrepancy; do not mark implementation or checkpoint complete. If any validation command fails, preserve the failure output, fix only the relevant implementation/test issue, and rerun the affected checks.
  - Confirm the final diff contains only the intentionally scoped implementation/test changes once implementation is authorized. In this requirements-first task-creation phase, the only file created is this `tasks.md`; no production code, test, package, or coverage-model file is changed.
  - _Requirements: 2.1–2.10, 3.1–3.8_
