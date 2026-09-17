# Appointment Patient Identity and Adaptive Intake Bugfix Design

## Overview

This bugfix covers two defects in the patient appointment conversation:

1. The appointment can be created, displayed, or routed with a different patient identity from the one the patient entered or explicitly selected. The highest-risk case is a phone collision, where a phone number already belongs to another patient and the flow can silently reuse that record.
2. Complaint-specific deep intake can be skipped or ended after only generic questions, even when a curated clinical pathway or a research/AI plan is available. This removes the focused history and safety screening that the doctor needs, with chest pain as the clearest example.

The design uses the bug-condition method. Identity correctness is enforced by treating the resolved patient record returned by the patient flow as the single source of truth, then carrying that patient ID through the pre-visit report, appointment, transcript, queue, and doctor views. Intake correctness is enforced by matching the complaint early, using the pathway as the primary frame when available, requiring a bounded minimum of focused deep questions, and falling back to pathway questions or generic complaint-aware probes when live AI or research is unavailable.

The changes described as already applied but not yet verified are verification targets, not assumptions of correctness: `POST /api/patients` can return `{ patient: existingRecord, existing: true }` for a phone collision; `ensurePatient` synchronizes the returned ID and name; pathway matching accepts significant non-adjacent token overlap; and deep intake uses `MIN_DEEP`, `MAX_DEEP`, and pathway fallback. No application code is implemented in this design phase.

### Affected Areas

The exact affected implementation areas are:

- `app/patient/appointment/page.tsx`: conversational identity collection, `ensurePatient`, complaint matching, research-plan kickoff, deep-question loop, red-flag snapshot, pre-visit report creation, appointment creation, transcript save, success display, and report upload association.
- `app/api/patients/route.ts`: phone normalization, phone lookup, patient creation, and the already-applied existing-record response for phone collisions.
- `app/api/appointments/route.ts`: patient existence validation and appointment persistence using `patientId`.
- `lib/clinicalPathways.ts`: curated pathway data, non-adjacent token-overlap matching, pathway guidance, and deterministic red-flag detection.
- `app/api/pre-visit/route.ts`: persistence and retrieval of the doctor-facing pre-visit brief under `patientId`.
- `app/api/appointments/chat/route.ts`: persistence and retrieval of the appointment transcript under `patientId` and `appointmentId`.
- `app/api/queue/route.ts`: appointment/check-in/queue linkage by patient and appointment IDs.
- `app/doctor/queue/page.tsx` and the queue data joins: doctor-facing patient name/initials display for the routed queue entry.

The separate UI request for medicine/test autocomplete with unit pricing and the follow-up calendar is preserved as unrelated context. It is out of scope for this bugfix and must not be folded into the identity or intake implementation except where regression tests must confirm that those independent UI areas are not changed.

## Glossary

- **Bug_Condition (C)**: An input state that either permits identity substitution/conflict during appointment creation or permits adaptive intake to complete without the required complaint-specific questioning and safety coverage.
- **Property (P)**: The required result for a buggy input: the appointment uses one explicitly resolved patient identity, and intake contains the minimum relevant focused history and safety screening before completion.
- **Preservation**: Behavior for inputs outside the bug condition must remain unchanged, including unambiguous patient reuse, valid appointment booking, already-covered pathway topics being skipped, generic non-triggering intake, mouse/UI behavior, and the separate medicine/test and calendar request context.
- **Resolved patient**: The one patient record whose ID is explicitly selected or confirmed by the user and returned by the patient lookup/creation operation. The resolved record supplies the authoritative name, initials, phone, and history.
- **Identity invariant**: Once resolved, `patientId` is immutable for the appointment flow; all patient-facing and doctor-facing artifacts use that ID and the name loaded from that same record.
- **Phone key**: The normalized last ten digits used by `app/api/patients/route.ts` to compare formatted versions of a mobile number.
- **Phone conflict**: A submitted phone key maps to a patient record whose confirmed identity differs from the identity entered by the user.
- **Curated pathway**: A `ClinicalPathway` in `lib/clinicalPathways.ts` with synonyms, core questions, red flags, and clinical context.
- **Deep question**: A complaint-specific question asked after the fixed identity, booking, and generic intake script. It is tracked with its answer and is included in the doctor-facing snapshot.
- **MIN_DEEP / MAX_DEEP**: The bounded deep-question controls already present in the appointment flow. The current targets are a minimum of 3 and an ordinary maximum of 5 deep questions.
- **Research/AI fallback**: Best-effort live research and reasoning used to select the next question when no curated pathway is available or when the curated pathway cannot determine the next useful question; deterministic fallback questions remain available offline.
- **Safety screening**: Pathway-specific and general red-flag checks over the complaint and all collected answers. Safety signals are deterministic, explainable, and must not be removed by an AI failure.

## Bug Details

### Bug Condition

The bug condition is the union of two independently testable conditions:

- The identity entered or selected by the patient conflicts with the phone-associated or previously selected record, and the flow can continue without explicit resolution while using the other record.
- The complaint requires focused adaptive questioning, but the flow can finalize after only the fixed generic questions, after an AI `STOP`, or after a failed pathway match without meeting the minimum focused-history and safety requirements.

**Formal Specification:**

```text
FUNCTION isBugCondition(input)
  INPUT: input containing identity state, phone state, complaint state,
         selected patient record, deep questions, and completion state
  OUTPUT: boolean

  identityConflict :=
    input.phoneKey maps to an existing patient
    AND input.enteredIdentity is not the confirmed identity of that patient
    AND input.flow completes or routes using that patient without explicit resolution

  skippedFocusedIntake :=
    input.complaint requires complaint-specific adaptive intake
    AND input.flow completes
    AND (
      input.deepQuestionCount < MIN_DEEP
      OR requiredPathwayTopicsRemainUncovered(input)
      OR requiredSafetyScreeningWasNotCollected(input)
    )

  RETURN identityConflict OR skippedFocusedIntake
END FUNCTION
```

`MIN_DEEP` is currently 3 and `MAX_DEEP` is currently 5. `MAX_DEEP` bounds ordinary adaptive questioning; it is not permission to omit an unresolved urgent safety topic. If a pathway cannot fit all relevant topics into the ordinary bound, the design requires the implementation and tests to preserve the safety overlay and make the unresolved limitation visible to the doctor rather than silently presenting a complete history.

**Expected result specification:**

```text
FUNCTION expectedBehavior(input)
  INPUT: a buggy appointment/intake input where isBugCondition(input) is true
  OUTPUT: boolean

  identityOk :=
    input.appointment.patientId = input.resolvedPatient.id
    AND input.displayedPatientName = input.resolvedPatient.name
    AND input.doctorRoute.patientId = input.resolvedPatient.id
    AND no other patient record was overwritten or silently substituted

  intakeOk :=
    input.complaintPathway is used when confidently matched
    AND input.deepQuestionCount >= MIN_DEEP when adaptive intake is required
    AND required complaint-specific topics and applicable red flags are represented
    AND a pathway or research/AI fallback is used when the primary source is unavailable

  RETURN identityOk AND intakeOk
END FUNCTION
```

### Examples

- **Existing-record identity collision:** The patient enters “Vijay Verma” and mobile `9876543210`, while that normalized phone key belongs to “Rohan Mehta.” The actual defect is a silent booking for Rohan that still displays Vijay or otherwise routes inconsistently. Correct behavior is to show an explicit conflict/resolution state; only after the user confirms Rohan or supplies a valid different identity/phone may booking continue, and every artifact must use the resolved record.
- **Returning-patient mismatch:** A returning patient selects or is loaded as one patient, but a stale `patientId` or phone lookup returns another record. Correct behavior is to reject or resolve the mismatch before report saving or appointment creation; the stale record must not be used merely because it was found first.
- **Chest-pain skipped history:** The complaint is “seene me tez dard hai pichale 2 din se.” The non-adjacent matcher should recognize the chest-pain pathway despite the inserted words. It is defective to ask only “Have you seen a doctor?” and “Do you have reports?” and then book. Correct behavior includes at least three focused questions and covers onset/current status, location/character, radiation or exertional pattern, associated breathlessness/sweating/nausea/dizziness, relevant history, and emergency/urgent signals as far as the bounded flow permits.
- **No curated pathway or unavailable AI:** The patient reports a complaint that does not confidently match a curated pathway, or the research/reasoning request fails. It is defective to stop after generic questions. Correct behavior uses the research/AI plan when available and otherwise asks complaint-aware fallback probes for severity/frequency, associated symptoms, and worsening/triggers before completion.
- **Already-covered topic:** A patient’s complaint already states that the symptom began yesterday and is severe, and a prior answer covers location. The adaptive flow may skip duplicate duration, severity, or location questions, but it must retain the minimum focused-history count and still cover applicable safety topics.

## Expected Behavior

### Identity Invariants

The following invariants must hold from resolution through doctor routing:

1. **Single authoritative ID:** After `ensurePatient` resolves a record, the flow stores and reuses that exact `patientId`. It must not later derive a different ID from the entered name, phone, or stale state.
2. **ID/name consistency:** The displayed patient name and initials are read from the resolved patient response associated with that ID. A name typed before resolution is not authoritative after a collision.
3. **Appointment ownership:** The appointment request uses the resolved `patientId`; `/api/appointments` must verify that the patient exists and return the same patient association.
4. **Artifact ownership:** The pre-visit brief, uploaded report, transcript, and history lookups use the same resolved `patientId`. The transcript additionally uses the appointment ID returned by appointment creation.
5. **Routing ownership:** Check-in and queue records use the appointment’s patient ID. Doctor queue joins and displays must resolve the name from that same patient ID, never from the original free-text name.
6. **No mutation by collision:** A phone collision must not overwrite the existing patient’s name, phone, history, or other identity fields. Returning the existing patient is acceptable only as an explicit resolution path.
7. **Stable success state:** The success screen’s name and patient ID identify the same record that was persisted in the appointment and routed to the doctor.

### Phone-Conflict Resolution

- Phone comparison continues to use the normalized phone key so formatted equivalents are treated consistently.
- When `POST /api/patients` finds a collision, the already-applied `{ patient: existing, existing: true }` response is a resolution signal, not silent consent to book under that record.
- The appointment flow must distinguish “new identity submitted” from “existing identity returned.” It must require explicit user confirmation to use the returned existing patient, or require correction/another phone before creating/selecting a patient. It must not overwrite the existing record or display the submitted name as if it belongs to that record.
- A returning-patient phone lookup remains a valid reuse path when the user selected returning patient and the returned patient is the intended confirmed identity.
- Invalid or too-short normalized phone numbers remain request errors. Network, malformed response, or missing patient errors must leave the flow unbooked and explain that identity resolution failed.

### Adaptive Pathway and Stop Rules

- Once the complaint is known, the flow invokes `matchPathway` and starts the research plan in the background. A confident curated match is the primary question frame; the pathway’s core questions and red flags are not replaced by generic doctor/report questions.
- The flow enters deep intake after the fixed script and records every question/answer pair. It must ask at least `MIN_DEEP` (currently 3) complaint-specific deep questions for a complaint requiring adaptive intake.
- The AI may stop only after the minimum has been met and no required pathway/safety topic remains unaddressed. `MAX_DEEP` (currently 5) prevents an ordinary chat from dragging on; reaching it finalizes only after the available focused history and safety overlay have been applied.
- A question already answered in the complaint, fixed answers, or a previous deep answer may be skipped as redundant. Skipping is topic-aware, not a license to skip the entire pathway.
- If the AI returns `STOP`, an empty response, a duplicate, or an unusable question before the minimum, the flow uses the next uncovered pathway question. If no pathway exists, it uses the complaint-aware generic probes.
- If research or AI is unavailable, the flow continues offline with pathway questions when matched, or with the no-pathway fallback probes. The full pre-visit research/report step is best-effort and must not erase the collected intake or red flags when it fails.
- The complaint and all answers are passed through deterministic pathway/general red-flag detection. Emergency/urgent signals are retained in the report and can raise urgency; AI output cannot lower a deterministic safety escalation.

### Data Flow and Appointment-to-Patient Routing Guarantees

1. The appointment conversation collects identity, phone, complaint, fixed answers, deep answers, and optional reports.
2. `ensurePatient` resolves one patient record. The returned record ID and name become the flow’s authoritative identity pair; returning-patient history is loaded using that ID.
3. Complaint matching and background research prepare the deep phase. Deep question/answer pairs are merged into the intake snapshot, and pathway/general red flags are computed from the complaint and all answers.
4. The report is saved to `/api/pre-visit` with the resolved `patientId`. Report uploads, when present, use that same ID.
5. The appointment is posted to `/api/appointments` with the same `patientId`. The API verifies the patient exists before inserting and returns the appointment and associated patient.
6. The transcript is saved to `/api/appointments/chat` with the same `patientId`, the returned `appointmentId`, and the pre-visit `briefId`.
7. Check-in and queue entries use the appointment’s patient ID. Doctor-facing queue and brief joins read patient name/initials from that ID, so the doctor sees the resolved record rather than the original free-text identity.
8. The success view reports the same resolved ID/name pair used by the persisted appointment. Any mismatch at a boundary is a failure, not a reason to silently substitute another patient.

### Error Handling

- **Identity input errors:** Invalid or too-short phone keys return a validation error and keep the flow in identity collection; no patient, report, or appointment is created.
- **Phone collision:** The existing-record response is surfaced as an explicit conflict/resolution state. Confirmation continues with the returned record; rejection or correction stops booking until a resolvable identity is supplied. No existing row is overwritten.
- **Patient lookup/creation failure:** Network failure, malformed JSON, missing patient data, or a patient-ID conflict leaves `patientId` unresolved and shows a recoverable identity error. The flow must not continue to appointment creation with a guessed or stale ID.
- **Appointment persistence failure:** A missing patient is a `404`, a booked slot remains a `409`, and other appointment errors return an actionable message. The flow does not show success or claim a routed appointment unless the POST succeeds.
- **Research/AI failure:** Research and reasoning are best-effort. Failure, empty output, duplicate output, or early `STOP` invokes the curated pathway fallback or no-pathway complaint-aware probes, subject to the minimum and stop rules.
- **Report-generation failure:** The collected snapshot and deterministic safety overlay still produce a doctor-facing fallback report. The appointment can proceed only after intake requirements are satisfied; a failed research/report call must not discard answers or red flags.
- **Transcript or enrichment failure:** Failure to load past visits or save the transcript is non-fatal to an otherwise successful appointment, but it must be logged/observable and must never change the authoritative patient ID. A pre-visit or report write must not be retried under another patient.

### Preservation Requirements

**Unchanged Behaviors:**

- An unambiguous returning patient continues to reuse the intended record without a duplicate.
- A new patient with a genuinely unused phone continues through normal patient creation.
- A phone belonging to the same confirmed patient continues to reuse that valid record rather than creating an unnecessary duplicate.
- Valid appointment data continues to persist through `/api/appointments`, including normal slot-conflict handling and the established success state.
- Curated pathway questions that are already covered by the patient’s complaint or prior answers continue to be skipped, while uncovered safety topics and the minimum focused history remain protected.
- Non-triggering intake continues to use the existing valid flow and its current language, report-upload, appointment, transcript, and doctor-review behavior.
- The separate medicine/test autocomplete with unit pricing and follow-up calendar request remains untouched and is not made a dependency of this bugfix.

**Scope:**

Inputs outside identity conflict and premature/skipped adaptive intake must preserve their prior behavior. This includes ordinary mouse/touch interactions, non-pathway complaints whose configured intake is already sufficient, valid returning-patient lookups, normal appointment slot conflicts, report upload behavior, and unrelated appointment UI requests.

## Hypothesized Root Cause

1. **Identity sources are not explicitly separated:** The flow collects a free-text name but later relies on a phone lookup or collision response. Without an explicit resolution state, the returned record can silently replace the entered identity while the UI still renders the old name.
2. **Patient resolution is not treated as an immutable transaction:** `ensurePatient` can be called by finalization and report upload, and stale React/ref state or a second lookup can create opportunities for different artifacts to receive different IDs. The already-applied ID/name synchronization reduces this risk but needs verification across every call site.
3. **Phone collision semantics are ambiguous at the client boundary:** The API now returns an existing patient rather than an error. That makes reuse possible, but `existing: true` must be handled as an explicit confirmation or correction path rather than as an automatic new-patient success.
4. **Appointment and downstream joins trust IDs without proving end-to-end consistency:** Appointment persistence validates that a patient exists, but the flow must prove that the ID used for the brief, transcript, queue, success display, and doctor join is the same resolved ID.
5. **Adaptive intake can honor an early AI stop too broadly:** A generic AI response, `STOP`, duplicate, or failed call can terminate the deep phase without a hard minimum or without checking uncovered pathway topics. `MIN_DEEP`/`MAX_DEEP` and pathway fallback address the first failure mode but require regression tests for both matched and unmatched complaints.
6. **Pathway recognition was too dependent on adjacent phrases:** Patient wording such as “seene me tez dard” did not reliably match the synonym “seene me dard.” The applied significant-token overlap matcher is intended to fix this while retaining a score threshold to avoid false matches.
7. **Safety depends on asynchronous services unless the deterministic overlay is checked:** Research and reasoning calls can fail independently. The curated pathway, generic fallback, and deterministic red-flag scan must therefore remain authoritative fallbacks rather than allowing a network failure to become a premature successful booking.

## Correctness Properties

Property 1: Bug Condition - Resolved Patient Identity and Complete Adaptive Intake

_For any_ input where the bug condition holds (isBugCondition returns true), the fixed appointment flow SHALL require explicit phone-conflict resolution, use one resolved patient ID and its matching name through patient creation or selection, pre-visit report, appointment, transcript, success display, queue, and doctor routing, and SHALL collect at least `MIN_DEEP` relevant complaint-specific questions with applicable safety screening before completing adaptive intake, using a curated pathway or research/AI fallback as available.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Non-Buggy Patient, Appointment, and Intake Behavior

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), the fixed flow SHALL produce the same valid patient selection/creation, appointment persistence, display/routing, report and transcript association, covered-topic skipping, and configured non-triggering intake behavior as the original flow, preserving unrelated UI behavior including the separate medicine/test autocomplete with unit pricing and follow-up calendar context.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

These are implementation and verification targets for the next phase; this design phase does not modify application code.

1. **Make patient resolution explicit in `app/patient/appointment/page.tsx`.**
   - Represent the distinction between the entered identity, a returned existing record, and an explicitly resolved record.
   - On `{ existing: true }`, show an explicit confirmation/correction outcome before proceeding, rather than silently treating the collision as creation success.
   - Once resolved, cache the ID and record-derived name together and make every later call site use that resolution.
   - If the existing record is confirmed, load its history and use its name; if it is rejected, stop booking until the conflict is corrected.

2. **Preserve collision-safe API behavior in `app/api/patients/route.ts`.**
   - Keep phone normalization and the existing-record response as the server signal for a collision.
   - Ensure no collision path updates the existing row or creates a second record with ambiguous identity.
   - Keep invalid-phone and patient-ID conflict errors explicit and testable.

3. **Verify appointment-to-patient ownership in `app/api/appointments/route.ts`.**
   - Continue validating `patientId` before insertion and return the associated patient used for the appointment.
   - Verify that the response patient ID/name exactly matches the request’s resolved identity.
   - Preserve slot-conflict `409` behavior and do not insert an appointment when patient validation fails.

4. **Verify all downstream data flow uses the resolved ID.**
   - `app/patient/appointment/page.tsx` must use the same ID for report upload, `/api/pre-visit`, `/api/appointments`, `/api/appointments/chat`, and success state.
   - `app/api/pre-visit/route.ts` and `app/api/appointments/chat/route.ts` must retain patient-scoped records without accepting a mismatched display name as authority.
   - Queue check-in and doctor views must resolve names through the appointment/queue patient ID and not through conversation text.

5. **Verify pathway matching and safety frame in `lib/clinicalPathways.ts`.**
   - Retain the applied non-adjacent significant-token overlap behavior, including recognition of “seene me tez dard” as chest pain.
   - Retain the score threshold and explainable pathway/red-flag data to avoid turning generic words into a false clinical match.
   - Verify that red flags are scanned over the complaint, fixed answers, and deep answers, with emergency signals taking precedence.

6. **Enforce adaptive question bounds and stop conditions in `app/patient/appointment/page.tsx`.**
   - Retain `MIN_DEEP = 3` and `MAX_DEEP = 5` as the current bounded defaults unless a product decision changes them.
   - Do not honor AI stop/empty/duplicate output before the minimum; use an uncovered pathway question or no-pathway complaint-aware fallback instead.
   - Permit covered or duplicate topics to be skipped, but do not finalize while required pathway/safety coverage is absent merely because the generic script completed.
   - Ensure the deep transcript is folded into `answers.symptoms` before report generation.

7. **Keep research/AI failure non-blocking but safe.**
   - Continue using the background research plan when available.
   - On research, AI, report-generation, or final research failure, preserve collected answers and use the deterministic/pathway fallback; do not convert an unavailable service into zero deep questions.
   - Preserve the deterministic red-flag overlay and the doctor-facing disclaimer that AI output requires clinician review.

## Testing Strategy

### Validation Approach

Validation follows two phases: first reproduce the defects against the pre-fix behavior or an isolated regression fixture, then verify the applied changes and preservation behavior. Tests must exercise both API boundaries and the browser-flow state transitions. The design does not require a long-running development server; use single-run checks and a manually started server only when an integration harness requires it.

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate each defect and confirm whether the already-applied changes close it.

**Test Plan:** Use controlled patient records and mocked AI/research responses. Capture the patient ID/name at each boundary: after lookup/creation, after `ensurePatient`, pre-visit save, appointment POST response, transcript save, and queue/doctor read. For intake, record the pathway match, deep question count, question topics, stop reason, fallback source, and red flags.

**Test Cases:**

1. **Phone collision identity test:** Submit Vijay Verma with Rohan Mehta’s phone and verify the flow pauses for explicit resolution; no Rohan row is overwritten and no appointment is created under an unconfirmed identity.
2. **Resolved identity propagation test:** Confirm the existing record or choose an unambiguous new record, then verify the same ID and record-derived name appear in the pre-visit brief, appointment response, success state, transcript, queue, and doctor display.
3. **Chest-pain pathway test:** Submit “seene me tez dard hai pichale 2 din se,” verify non-adjacent token matching selects chest pain, and verify the flow does not book after only generic questions.
4. **Early-stop fallback test:** Make AI return `STOP`, empty output, a duplicate, or fail before three deep questions. Verify pathway fallback (or no-pathway generic probes) supplies the next question and completion remains blocked until the minimum.
5. **No-pathway research failure test:** Use an unmatched complaint and fail the research request. Verify fallback questions gather severity/frequency, associated symptoms, and worsening/triggers, and that the resulting report still contains the complaint and answers.
6. **Safety overlay test:** Include chest-pain radiation/breathlessness or another pathway/general red flag in a deep answer. Verify the signal is present in the report and urgency is not lowered by an AI response.

### Fix Checking

**Goal:** Verify that every input in the bug condition satisfies the identity and adaptive-intake property.

**Pseudocode:**

```text
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedAppointmentFlow(input)
  ASSERT expectedBehavior(input, result)
  ASSERT result.appointment.patientId = result.resolvedPatient.id
  ASSERT result.deepQuestionCount >= MIN_DEEP when adaptive intake is required
  ASSERT result.safetyScreening is preserved
END FOR
```

Fix checking must include API-level assertions for response status/body and flow-level assertions for state transitions. A successful HTTP response alone is insufficient if the displayed name, appointment ID association, transcript, or doctor route points to a different patient.

### Preservation Checking

**Goal:** Verify that non-triggering inputs remain behaviorally equivalent to the original flow.

**Pseudocode:**

```text
FOR ALL input WHERE NOT isBugCondition(input) DO
  original := originalAppointmentFlow(input)
  fixed := fixedAppointmentFlow(input)
  ASSERT fixed.patientSelection = original.patientSelection
  ASSERT fixed.appointmentPersistence = original.appointmentPersistence
  ASSERT fixed.intakeOutcome = original.intakeOutcome
  ASSERT fixed.unrelatedUIBehavior = original.unrelatedUIBehavior
END FOR
```

**Testing Approach:** Use deterministic fixtures and property-style generators for phone formatting, identity combinations, pathway wording, prior-answer coverage, and AI outcomes. Compare the pre-fix behavior where it is valid to preserve it, and compare the fixed behavior against explicit invariants where the original behavior was defective.

**Preservation Test Cases:**

1. **Same-identity phone reuse:** A confirmed returning patient uses differently formatted versions of the same phone; the same patient record is reused and no duplicate is made.
2. **Unused-phone creation:** A new patient with a unique valid phone is created once, and the appointment uses that record and name.
3. **Covered pathway topics:** Complaint text and prior responses cover duration/location/severity; the adaptive flow skips redundant questions but still maintains the minimum and safety checks.
4. **Valid appointment and slot conflict:** A normal appointment succeeds; a duplicate slot remains a `409` and does not create a second appointment.
5. **Other interactions and UI:** Report upload, language selection, mouse/touch controls, non-pathway sufficient intake, medicine/test autocomplete with unit pricing, and follow-up calendar behavior remain unchanged.

### Unit Tests

- Test `phoneKey` equivalence for country-code, punctuation, and leading-zero formats, plus invalid phone rejection.
- Test patient POST collision responses: existing patient returned, no overwrite, no duplicate, and explicit `existing` signal.
- Test `ensurePatient`-equivalent resolution logic for new, returning-found, returning-not-found, collision-confirmed, collision-rejected, and network-error cases.
- Test appointment POST patient existence, returned patient association, slot conflict, and no insertion on invalid identity.
- Test `matchPathway` for adjacent and non-adjacent chest-pain phrases, threshold behavior, and unrelated false positives.
- Test deep loop boundaries: first question starts deep intake, `MIN_DEEP` blocks early stop, `MAX_DEEP` bounds ordinary questioning, duplicates are skipped, and pathway/no-pathway fallbacks provide usable questions.
- Test deterministic red-flag detection and urgency ordering over complaint plus all deep answers.

### Property-Based Tests

- Generate equivalent phone formats and identity combinations; assert that only explicit resolution can produce a booking and that all resulting artifacts share one patient ID/name pair.
- Generate complaint text with inserted non-stop words between significant pathway tokens; assert that recognized pathway phrases continue to match without matching generic unrelated text.
- Generate AI outcomes (`STOP`, empty, duplicate, valid question, throw) and prior deep-question counts; assert no early completion below `MIN_DEEP`, bounded completion at/after `MAX_DEEP`, and fallback availability.
- Generate pathway coverage states and answer orderings; assert already-covered topics may be skipped while unanswered relevant/safety topics are not silently discarded.
- Generate non-triggering patient, appointment, and intake inputs; assert preservation of prior valid behavior and unrelated UI request boundaries.

### Integration Tests

- Run the complete appointment flow from identity questions through success, then query the appointment, pre-visit brief, transcript, queue, and doctor queue to verify end-to-end patient routing.
- Run the phone-collision flow with explicit confirmation and rejection branches, including refresh/retry and slot conflict behavior.
- Run chest-pain and another matched pathway through fixed questions, deep questions, report generation, deterministic safety overlay, appointment creation, and doctor-facing brief.
- Run an unmatched complaint with research success, research failure, AI failure, and report-generation failure; verify the appointment is not prematurely finalized and the fallback report remains useful.
- Run regression smoke checks for normal booking, returning-patient lookup, report upload, language/UI interactions, and the separate medicine/test autocomplete and follow-up-calendar work without requiring those features to participate in this bugfix.

### Project Validation Commands

The repository exposes these single-run checks after implementation: `npm run lint` and `npm run build`. If targeted test files are added in the implementation phase, run the repository’s configured single-run test command for those files. Do not use `npm run dev`, `npm start`, or watch-mode commands as validation in this phase; a development server, if needed for manual integration testing, should be started by the user separately.
