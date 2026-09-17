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
- Attachments can be selected during intake and are represented in the intake context. Persistent object storage upload is deliberately not claimed by this UI; it requires the existing document-storage workflow to be connected separately.

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
## AI provider boundary

The patient appointment flow now uses the server-side `/api/ai/chat` boundary for conversational AI. It sends the existing prompts and context to OpenAI `gpt-5.4-mini`; the browser never receives `OPENAI_API_KEY`. Configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in `.env.local`.

The existing Puter.js client and script remain in the repository for compatibility, but `/demo`, `/patient/appointment`, and `/patient/ai-intake` no longer require Puter login and their conversational calls do not use Puter. Image attachments in the primary appointment flow use the same server boundary; PDF files are still uploaded/persisted for the doctor but are not sent to Puter or automatically vision-read. The UI, answers, edit/replay, context-consistency, safety, and phone-lookup logic remain unchanged.

## ZIP operations UI in the GitHub checkout

The ZIP preview operations shell is now the default `/demo` surface in the GitHub checkout. It includes the ZIP navigation and views for Dashboard, Appointments, Patients, Reports & Documents, Inventory, Billing, Analytics, and Settings. The shell is wrapped in the target Redux provider and does not require a Puter login.

The target PostgreSQL schema remains authoritative. The following compatibility routes adapt its existing records to the ZIP UI contracts without replacing the database layer:

- `/api/dashboard/summary`
- `/api/inventory/medicines`
- `/api/inventory/services`
- `/api/patients/360`
- `/api/patient-intake` (alias of the authoritative appointment-intake persistence route)

Existing target routes continue to provide patients, appointments, billing, reports, prescriptions, inbox, insights, and profile settings. The client API adapter normalizes target appointment/patient/billing fields for the ZIP components. This keeps the ZIP layout and interactions while preserving the GitHub repository's database and seeded data.
