# Implementation Plan

## Scope and execution notes

This plan implements and verifies the bugfix described in `bugfix.md` and `design.md`. It uses the bug-condition workflow: reproduce the identity and adaptive-intake defects first, observe and capture non-buggy behavior, then verify/refine the already-applied changes before completing regression and integration validation. Do not implement application code during task-plan creation; implementation begins only when the implementation task is executed.

The current adaptive-intake bounds are `MIN_DEEP = 3` and `MAX_DEEP = 5`. `MAX_DEEP` bounds ordinary questioning but does not permit an unresolved urgent safety topic to be silently omitted. The separate medicine/test autocomplete with unit pricing and the follow-up calendar request are unrelated work and are explicitly out of scope; only regression checks may confirm that those areas were not changed or made dependencies of this bugfix.

- [ ] 1. Write and run the bug-condition exploration property before changing the fix
  - **Property 1: Bug Condition** - Explicit identity resolution and complete adaptive intake
  - **IMPORTANT**: This is a standalone exploration task and MUST be completed before implementation or refinement. Run it against the unfixed behavior or an isolated regression fixture; expected failures confirm the defects.
  - **Bug condition**: `isBugCondition(input)` is true when a normalized phone key maps to an existing patient whose confirmed identity differs from the entered identity and the flow can complete or route without explicit resolution, OR when a complaint requires adaptive intake but completion occurs with fewer than `MIN_DEEP` focused questions, uncovered required pathway topics, or missing applicable safety screening.
  - **Identity exploration**: Use a controlled collision such as entered `Vijay Verma` with a phone belonging to `Rohan Mehta`; verify whether the flow silently reuses or overwrites Rohan, displays the entered name against Rohan’s record, creates a report/appointment under an unconfirmed identity, or routes to the wrong patient. Capture the patient ID and name at patient resolution, pre-visit save, appointment POST, transcript save, success state, queue, and doctor display.
  - **Adaptive exploration**: Exercise `seene me tez dard hai pichale 2 din se`, an equivalent recognized Hindi/Hinglish chest-pain phrase, an unmatched complaint, and AI outcomes of `STOP`, empty output, duplicate output, and failure. Record pathway match, deep question count, question topics, fallback source, completion state, and red flags. Confirm the unfixed flow can book after only generic doctor/report questions or before the minimum/safety coverage.
  - **Expected unfixed outcome**: At least one concrete counterexample demonstrates silent identity substitution or premature completion. Document exact inputs, returned IDs/names, question/answer sequence, stop reason, and missing safety/topic coverage. Do not “fix” the failing exploration test to make the unfixed run pass.
  - **Expected fixed outcome when rerun**: The same property passes only after explicit conflict resolution, immutable identity propagation, minimum focused intake, pathway/fallback questioning, and safety preservation are implemented.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write and run preservation property tests before implementation
  - **Property 2: Preservation** - Non-buggy patient, appointment, routing, and intake behavior
  - **IMPORTANT**: This is a standalone observation-first task and MUST pass on the unfixed behavior before implementation. Capture actual behavior first; do not assert an assumed redesign.
  - **Non-bug condition**: `isBugCondition(input)` is false: identity is unambiguous or the phone belongs to the same confirmed identity; the phone is genuinely unused; intake is already sufficient for the configured non-triggering flow; or a curated pathway’s relevant topics are already covered by the complaint/prior answers.
  - **Observe and encode**: (a) reuse a returning patient with equivalent punctuation/country-code/leading-zero phone formats; (b) create a new patient with an unused valid phone; (c) book valid appointment data and preserve normal slot-conflict `409` behavior; (d) skip redundant covered duration/location/severity questions while retaining required minimum/safety behavior; (e) preserve existing non-pathway sufficient intake, report upload, language, mouse/touch, success, transcript, queue, and doctor-review behavior.
  - **Unchanged identity behavior**: For the same confirmed patient, verify no unnecessary duplicate is created and all artifacts continue to use that record. For a unique phone, verify one patient is created and the appointment uses the created record and name.
  - **Unchanged intake behavior**: Verify covered topics remain skippable and ordinary non-triggering complaints continue through the configured flow without unrelated wording/UI changes.
  - **Expected unfixed outcome**: These tests pass before the fix, establishing the baseline to preserve. Document observed responses and state transitions, including API status/body and persisted associations.
  - **Expected fixed outcome when rerun**: The same tests pass after implementation with no regression.
  - **Out of scope**: Do not add medicine/test autocomplete, unit pricing, or follow-up-calendar behavior to the implementation; only capture a regression boundary proving this bugfix does not alter or depend on it.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Implement and refine the fix using the exploration and preservation evidence
  - The changes below are implementation and verification targets. Treat the design’s already-applied changes—`{ patient: existingRecord, existing: true }`, `ensurePatient` ID/name synchronization, non-adjacent token overlap, and `MIN_DEEP`/`MAX_DEEP` fallback—as untrusted until tests prove their behavior; refine them when the tests expose gaps.

  - [ ] 3.1 Make phone-conflict resolution explicit and collision-safe
    - In `app/api/patients/route.ts`, verify/refine normalized phone-key comparison, invalid/too-short phone validation, and the existing-record response `{ patient: existingRecord, existing: true }` as an explicit collision signal.
    - Ensure collision handling neither overwrites the existing patient’s name, phone, history, or identity fields nor creates an ambiguous duplicate.
    - In `app/patient/appointment/page.tsx`, distinguish entered identity, returned existing record, and explicitly resolved patient. On `existing: true`, present a confirmation/correction branch before booking; confirmation adopts the returned record-derived identity, while rejection/correction leaves the flow unbooked until a resolvable identity is supplied.
    - Preserve valid returning-patient reuse when the selected/confirmed identity matches the returned record; network, malformed, missing-patient, and patient-ID conflicts must leave identity unresolved rather than guessing or using stale state.
    - _Bug_Condition: `input.phoneKey` maps to an existing patient with a different confirmed identity and the flow would otherwise complete or route without explicit resolution._
    - _Expected_Behavior: No silent reuse/overwrite; only an explicitly resolved patient can be booked, displayed, or routed._
    - _Preservation: Same-identity phone reuse, unique-phone creation, invalid-phone errors, and recoverable identity errors retain their existing semantics._
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2_

  - [ ] 3.2 Enforce immutable resolved patient ID/name propagation through every artifact and route
    - Verify/refine `ensurePatient` so the resolved record’s ID and name/initials become one authoritative identity pair and are cached/reused for the remainder of the flow; no later lookup, free-text name, stale ref, or report-upload call may derive a different patient.
    - Verify/refine `app/api/appointments/route.ts` to validate patient existence before insertion, preserve normal slot-conflict `409`, and return the same associated patient ID/name used by the request.
    - Verify/refine `app/api/pre-visit/route.ts`, report upload association, and `app/api/appointments/chat/route.ts` so brief, uploaded report, transcript, and history records use the resolved `patientId`; transcript additionally uses the returned `appointmentId` and brief ID.
    - Verify/refine success display state to show the same resolved ID/name pair as the persisted appointment, without showing the originally typed name after a collision resolution.
    - Verify/refine queue check-in and doctor queue joins (`app/api/queue/route.ts`, `app/doctor/queue/page.tsx`) so patient name/initials are resolved from the appointment/queue patient ID, never from conversation text.
    - Add boundary assertions that any ID/name mismatch is treated as a failure and never silently substituted.
    - _Bug_Condition: Identity can change between patient resolution, report, appointment, transcript, success, queue, or doctor routing._
    - _Expected_Behavior: `patientId` is immutable after resolution and every artifact/display/route uses that ID and its record-derived name._
    - _Preservation: Valid appointment persistence, report upload, transcript, success state, queue behavior, and doctor review remain unchanged for non-conflicting identities._
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.5_

  - [ ] 3.3 Verify/refine robust non-adjacent complaint and pathway matching
    - In `lib/clinicalPathways.ts`, verify the already-applied significant-token overlap matcher recognizes inserted-word variants such as `seene me tez dard` as the chest-pain pathway while preserving an explainable score threshold.
    - Test adjacent and non-adjacent synonyms, punctuation/case/language variants, partial phrases, and unrelated text containing generic words; refine token normalization/scoring only where failures show false negatives or false positives.
    - Once a confident pathway is selected, use it as the primary deep-question frame rather than allowing generic doctor/report questions to replace its core questions and red flags.
    - _Bug_Condition: A complaint that requires a curated pathway is not matched because significant tokens are non-adjacent, or the matched pathway is not used for focused intake._
    - _Expected_Behavior: Recognized non-adjacent complaint wording selects the appropriate pathway and preserves its focused topics and safety frame._
    - _Preservation: Existing adjacent matches, threshold behavior, and unrelated complaints remain unchanged._
    - _Requirements: 1.3, 2.3, 2.4, 3.3, 3.4_

  - [ ] 3.4 Enforce `MIN_DEEP`/`MAX_DEEP` stop rules and topic-aware duplicate handling
    - In `app/patient/appointment/page.tsx`, verify/refine `MIN_DEEP = 3` and `MAX_DEEP = 5` as bounded defaults. Enter deep intake after the fixed script for complaints requiring adaptive intake and record every deep question/answer pair.
    - Do not honor AI `STOP`, empty, duplicate, unusable, or thrown output before `MIN_DEEP`; use the next uncovered curated pathway question or complaint-aware fallback probe instead.
    - Permit a question to be skipped only when its topic is already covered by the complaint, fixed answers, or prior deep answers. Do not finalize merely because generic questions completed or because a duplicate was encountered.
    - At or after `MAX_DEEP`, finalize ordinary questioning only after available focused history and safety overlay are applied. If urgent safety coverage remains unresolved, preserve the unresolved limitation visibly for the doctor rather than claiming a complete history.
    - Fold deep question/answer pairs into `answers.symptoms` before report generation and completion checks.
    - _Bug_Condition: Adaptive intake completes with fewer than `MIN_DEEP` relevant questions, uncovered required pathway topics, or missing safety screening, including after an early AI stop._
    - _Expected_Behavior: At least three focused questions are collected when required; ordinary questioning is bounded at five; covered topics may be skipped; required safety coverage cannot be silently discarded._
    - _Preservation: Already-covered pathway topics remain skippable and sufficient non-triggering intake retains its existing completion behavior._
    - _Requirements: 1.3, 2.3, 2.4, 3.3, 3.4_

  - [ ] 3.5 Add curated pathway fallback, research/AI fallback, and deterministic safety preservation
    - Start the configured research plan in the background once the complaint is known, but keep curated pathway questions authoritative when a confident match exists.
    - When no pathway is available, the pathway cannot determine the next useful question, or research/AI fails, returns empty/duplicate/`STOP`, or returns an unusable question, use complaint-aware fallback probes covering severity/frequency, associated symptoms, and worsening/triggers. Do not turn service unavailability into zero deep questions.
    - Verify/refine deterministic red-flag detection over the complaint, fixed answers, and all deep answers; retain chest-pain/urgent signals such as radiation, breathlessness, sweating, nausea, dizziness, or other general red flags and ensure AI output cannot lower urgency.
    - On report-generation or final research failure, preserve the collected snapshot and safety overlay in a doctor-facing fallback report; transcript/enrichment failures remain observable/non-fatal without changing the authoritative patient ID.
    - Preserve clinician-review disclaimers where AI output is present.
    - _Bug_Condition: Complaint-specific intake stops after generic questions or unavailable research/AI without minimum relevant history and safety screening._
    - _Expected_Behavior: Curated pathway or research/AI fallback continues focused questioning, deterministic safety is retained, and completion is blocked until requirements are met._
    - _Preservation: Existing valid non-pathway intake and best-effort enrichment behavior remain intact when no bug condition is present._
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 2.5, 3.3, 3.4, 3.5_

  - [ ] 3.6 Add focused unit and property-based coverage for the implementation
    - Add unit coverage for phone-key equivalence and invalid rejection; patient collision response/no-overwrite/no-duplicate; explicit resolution branches; appointment patient validation/association/slot conflict; pathway adjacent/non-adjacent matching and false-positive threshold; deep-loop boundaries, duplicate skipping, and fallback selection; and deterministic red-flag ordering.
    - Add property-based coverage generating equivalent phone formats and identity combinations, inserted non-stop complaint tokens, AI outcomes (`STOP`, empty, duplicate, valid, throw), prior deep-question counts, pathway coverage/orderings, and non-triggering inputs.
    - Assert that only explicit resolution can book a collision and that all resulting artifacts share one immutable patient ID/name pair. Assert no early completion below `MIN_DEEP`, bounded completion at/after `MAX_DEEP`, fallback availability, uncovered safety preservation, and non-buggy behavioral preservation.
    - Keep tests deterministic and single-run; do not add a watch-mode or long-running server dependency.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.7 Verify/refine API and browser-flow error handling without identity substitution
    - Verify invalid/too-short phone input keeps the flow in identity collection with no patient, report, or appointment created.
    - Verify collision rejection/correction, network failure, malformed JSON, missing patient, and patient-ID mismatch produce recoverable identity errors and no guessed/stale ID.
    - Verify appointment persistence failure prevents success/routing claims; preserve `404` for missing patient, `409` for booked slot, and actionable messages for other failures.
    - Verify transcript/enrichment failures are logged/observable and non-fatal only after the appointment is valid, and no retry is made under another patient.
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.5_

  - [ ] 3.8 Verify bug-condition property now passes
    - **Property 1: Expected Behavior** - Explicit identity resolution and complete adaptive intake
    - Re-run the exact exploration property from task 1; do not write a replacement test.
    - Confirm collision flows pause for explicit resolution, reject unconfirmed booking, avoid overwrites/duplicates, and propagate one resolved ID/name through patient, report, appointment, transcript, success, queue, and doctor routing.
    - Confirm chest-pain non-adjacent matching, pathway deep questions, no-pathway fallback, early-stop handling, `MIN_DEEP`, `MAX_DEEP`, and deterministic red flags satisfy the expected behavior.
    - **EXPECTED OUTCOME**: Property passes for every generated/scoped bug-condition input.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.9 Verify preservation property tests still pass
    - **Property 2: Preservation** - Non-buggy patient, appointment, routing, and intake behavior
    - Re-run the exact preservation tests from task 2; do not write replacement tests.
    - Confirm same-identity reuse, unique-phone creation, normal appointment and slot-conflict behavior, covered-topic skipping, non-pathway sufficient intake, report upload, language/UI interactions, transcript, queue, and doctor review remain valid.
    - Confirm medicine/test autocomplete with unit pricing and follow-up calendar remain outside this implementation and are not required by the bugfix.
    - **EXPECTED OUTCOME**: All preservation tests pass with no unrelated behavior change.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Run end-to-end integration and regression validation
  - Run the complete appointment flow from identity through success, then query the persisted appointment, pre-visit brief, transcript, queue, and doctor queue to prove end-to-end routing uses one patient ID/name.
  - Run collision confirmation and rejection/correction branches, refresh/retry behavior, and slot-conflict behavior; verify no stale patient ID can reach report or appointment persistence.
  - Run chest-pain and another matched pathway through fixed questions, deep questions, report generation, deterministic safety overlay, appointment creation, and doctor-facing brief.
  - Run an unmatched complaint with research success, research failure, AI failure, early `STOP`, empty/duplicate output, and report-generation failure; verify fallback questions and useful fallback report behavior without premature completion.
  - Run regression smoke checks for normal booking, returning-patient lookup, report upload, language/UI interactions, and doctor review. Confirm the separate medicine/test autocomplete with unit pricing and follow-up calendar request were not changed and are not dependencies of this bugfix.
  - Run the repository’s single-run validation commands after implementation: `npm run lint`, `npm run build`, and configured single-run targeted tests. Do not use `npm run dev`, `npm start`, or watch-mode commands; if manual integration needs a server, the user starts it separately.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Checkpoint - Confirm all tests pass and scope is clean
  - Confirm the Property 1 exploration test passes after the fix and the Property 2 preservation tests pass before and after the fix.
  - Confirm unit, property-based, integration, regression, lint, and build validation results are recorded, with any counterexamples resolved or documented as remaining defects.
  - Confirm no application code, dependency, or UI work for medicine/test autocomplete, unit pricing, or follow-up calendar was introduced as part of this bugfix.
  - Confirm the final implementation satisfies the identity invariant, phone-conflict explicit-resolution requirement, non-adjacent matching, `MIN_DEEP`/`MAX_DEEP` stop rules, curated/research/AI fallback, deterministic red-flag preservation, and immutable doctor routing.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_
