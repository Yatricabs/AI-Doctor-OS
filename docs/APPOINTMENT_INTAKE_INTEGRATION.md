# Conversational Appointment Intake

**Last updated:** 2026-09-16
**Route:** `/patient/ai-intake`

## Purpose

This is an additive, patient-facing appointment-intake flow. It brings the ZIP-preview conversational booking experience into the main AI Doctor OS checkout without replacing the established `/patient/appointment` booking experience or existing patient routes.

## Flow

1. Patient selects new or existing patient.
2. The mobile input performs a real `GET /api/patients?phone=...` lookup when exactly ten digits are present. Stale asynchronous lookup responses are ignored.
3. An existing match offers follow-up or new-patient choice. New patients provide name, age, the existing `SEX` field (`Man`, `Woman`, `Transgender Man`, `Transgender Woman`), city, appointment date and time.
4. The chief complaint is assessed against accumulated answers and derived semantic facts before a standard clinical question is selected.
5. The application asks one validated next clinical question at a time. The model boundary may propose a question from an allowlist only; it cannot mutate patient state or choose arbitrary workflow steps.
6. The intake is saved through `POST /api/appointment-intake`, which uses the main application's patient and appointment database helpers and creates a pre-visit brief.

The workspace Appointments screen now uses `/patient/ai-intake` as the default entry point for both new and follow-up appointments. The former `/patient/appointment` page remains available as a legacy route but is no longer the default navigation target.

## Semantic and edit safeguards

- Semantic facts are derived evidence, not a replacement for authoritative structured answers.
- A semantic inconsistency or ambiguity must be clarified before the adaptive-question fallback runs.
- Patient answers expose an Edit action. Saving an edit removes downstream answers, question log, and semantic facts, then rebuilds the clinical path from the changed answer. Cancel closes the editor without mutating state.
- Attachments can be selected during intake and are represented in the intake context with patient provenance. After the appointment creates a patient ID, the selected files are sent through the existing private report-upload workflow; image reports receive a bounded, clearly marked AI extraction attempt for clinician review. A timeout or unavailable AI service never blocks appointment creation, and PDF/text extraction remains subject to the existing doctor-side review workflow.

## Files

- `components/AppointmentIntakeFlow.tsx` — real patient UI, lookup, edit/replay and flow orchestration.
- `lib/appointmentIntakeAi.ts` — narrowly scoped Puter JSON boundary with no direct state mutation.
- `lib/appointmentIntakeReasoning.ts` — schema validation, semantic consistency assessment and allowlisted next-question selection.
- `app/api/appointment-intake/route.ts` — target-database appointment and pre-visit-brief persistence.
- `app/patient/ai-intake/page.tsx` — patient route and AI login gate.

## Operational notes

The system remains application-controlled: identity, scheduling, persistence, red-flag safeguards, edit/replay integrity, and allowed transitions remain deterministic. AI output is advisory and schema-validated. If Puter is not authenticated, the UI remains accessible through the provided non-AI continuation gate, and the deterministic question fallback remains available.

## ZIP preview seed-data migration

The ZIP preview uses in-memory demo seed records, while the integrated checkout uses PostgreSQL. `scripts/migrate-zip-preview-patient-data.mjs` imports its persisted operational seed data: patients, reports, appointments, available pre-visit briefs, medicines, tests/scans/procedures, billing transactions, inbox alerts, operational insights, and the ZIP clinic profile settings. It does not delete target data or overwrite unrelated records.

Run a read-only review first, then explicitly apply it while the ZIP preview is running:

```powershell
node scripts/migrate-zip-preview-patient-data.mjs
node scripts/migrate-zip-preview-patient-data.mjs --apply
```

The import is idempotent. ZIP seed IDs that are already present are updated to the source seed values (including the mobile number), and missing seed IDs are inserted. ZIP billing transaction IDs are namespaced as `zip-bill-*` in the target billing model, so they cannot collide with production bills.

## Clinical context gate

The production `/patient/appointment` route evaluates the complaint against the already selected SEX context before moving from complaint to duration. A reported reproductive/vaginal symptom with `Male` is held for respectful clarification; SEX and the complaint remain unchanged until the patient clarifies. The duration question resumes only after clarification.

## Adaptive turn-decision architecture

The patient-facing `/patient/ai-intake` flow now evaluates every clinical answer through one application-controlled cycle:

```text
patient answer
  -> deterministic safety screen
  -> semantic fact extraction (with patient/previous-context provenance)
  -> cross-turn consistency check
  -> clinical pathway and coverage context
  -> one allowlisted next action from the AI
  -> schema validation and rendering
```

`lib/appointmentContextConsistency.ts` extracts clinically relevant evidence such as anatomy, body site, symptoms, severity, medication/history claims and reproductive claims. It detects material mismatches (including opposing claims and changed location) without silently changing structured answers. Safety and contradiction outcomes stop routine questioning before the model or fallback can select duration.

`lib/appointmentIntakeReasoning.ts` is the model boundary. It accepts the complete current context, previous-patient summary, semantic facts, document metadata, pathway and coverage. The model can return only an allowlisted action (`ASK_QUESTION`, `CLARIFY_CONTRADICTION`, `SAFETY_ESCALATION`, `REQUEST_DOCUMENT`, or the other validated intake actions); it cannot choose a workflow step or mutate Redux/state. If the model is unavailable or malformed, the fallback is selected only after the deterministic gates pass and uses the current missing-information context rather than a blind queue.

Existing patient selection loads the compact history summary from `/api/appointments/chat?patientId=...&context=1`, including recent briefs, active medicines and follow-up information. Selected documents carry patient provenance through intake and are uploaded to the existing private report workflow after the patient/appointment has an ID. AI-generated facts remain derived evidence and are persisted as such in appointment notes; they do not become doctor-approved diagnoses or treatment.

Each turn emits concise decision metadata (fact kinds, contradiction/safety reason codes, covered dimensions, selected action, confidence and source) to the server audit log through `/api/intake/debug`. Raw hidden model reasoning is never exposed to patients. This gives production debugging without making observability a second clinical state store.

Regression coverage is in `scripts/appointment-intake-context-tests.mjs` and runs with `npm run test:appointment-intake-context`. It covers immediate Man/vaginal-context clarification, Woman/vaginal consistency, Man/penile context, opposing medication claims, changed body site, safety priority, explicit SEX correction and fact provenance.
## AI provider boundary

The patient appointment flow now uses the server-side `/api/ai/chat` boundary for conversational AI. It sends the existing prompts and context to OpenAI `gpt-5.4-mini`; the browser never receives `OPENAI_API_KEY`. Configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in `.env.local`.

The existing Puter.js client and script remain in the repository for compatibility, but `/demo`, `/patient/appointment`, and `/patient/ai-intake` no longer require Puter login and their conversational calls do not use Puter. Image attachments in the primary appointment flow use the same server boundary; PDF files are still uploaded/persisted for the doctor but are not sent to Puter or automatically vision-read. The UI, answers, edit/replay, context-consistency, safety, and phone-lookup logic remain unchanged.
