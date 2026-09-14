# AI UPCHAR — Project Status / परियोजना स्थिति

**Last Updated:** 2026-09-14
**Version:** v2.0
**Live Demo:** https://aiupchar.com/demo

> यह document batata hai ki **kya complete hai**, **kya abhi pending hai**, aur **current implementation ki boundaries kya hain**. AI UPCHAR ka core principle hai: **AI assists. Clinicians decide.**

---

## 1. Recent delivery since 2026-09-12 / हाल की डिलीवरी

The items below are committed work in the repository history. They are grouped by workstream so the completed product behavior is distinguishable from future production hardening.

### 1.1 Platform, data, and AI / प्लेटफ़ॉर्म, डेटा और AI

| Commit | Completed work |
| --- | --- |
| `71820d0` | Data layer migration toward Supabase Postgres and Puter.js client-side AI across API/client boundaries. This is a migration path, not a claim that every production write has completed a single-store cutover. |
| `4c7ce52` | Real browser-side AI and patient report intelligence: Puter client/types/prompts, report upload/storage, signed URLs, GPT-4o + Gemini vision findings, report-driven adaptive questions, and detailed pre-visit report summary. |
| `f84e510` | Combined Puter login gate with optional degraded mode. The appointment workflow can continue when browser AI is unavailable or skipped. |
| `646e190` | Server-side AI/hybrid intake state-machine foundation and AI endpoints. Server AI is optional; the browser User-Pays path remains the primary demo path. |

### 1.2 Patient intake and appointment / रोगी intake और appointment

| Commit | Completed work |
| --- | --- |
| `d1dca7d` | AI conversational appointment flow, internet research, training-data capture, and pre-visit report preparation. |
| `341cf36` | Guaranteed non-empty bilingual appointment questions, greeting, AI adaptive follow-ups, and question logging. |
| `d6a73a4` | Puter sign-in gate at the start of appointment flow so AI connects up front rather than interrupting the conversation later. |
| `03165a0` | Complaint-specific deep questioning with the reasoning model and complaint-aware fallback. |
| `2392465` | Research-informed history/question planning and a section-wise doctor report. This is structured history/report assistance for clinician review, not autonomous diagnosis. |
| `f855511` | Duplicate-question prevention, firmer `STOP` handling, and a double-submit processing lock. |
| `42bd3fa` | Per-appointment chat history, AI past-visit context, and printable prescription support. |

The current appointment flow is intentionally adaptive rather than a universal questionnaire:

1. A fixed script captures new/returning status, phone and identity details, basic demographics, appointment date/time, chief complaint, duration, prior care, and report prompts.
2. The complaint is resolved against the curated clinical context. A pathway, when confidently available, frames focused history; research/AI and deterministic fallback support unmatched complaints or unavailable services.
3. The dynamic deep phase asks one new complaint-specific question at a time, records question/answer metadata, and uses coverage to avoid re-asking dimensions already supported by the patient’s own words.
4. Research and report generation are best-effort. The collected snapshot and deterministic safety overlay remain available if external AI/research fails.
5. Finalization saves the doctor-facing pre-visit report, creates the appointment, saves the transcript, and shows the established success state.

There is no universal question list and no fixed clinical question count. `MAX_DEEP` is a ceiling for ordinary dynamic questioning; adaptive coverage and explicit safety evidence determine completion. If the ceiling is reached with unresolved safety, the limitation is retained for clinician review rather than represented as a safely completed screen.

### 1.3 Clinical pathways and safety / clinical safety

| Commit | Completed work |
| --- | --- |
| `bc1c48f` | Phase-1 clinical pathway library and explainable general/pathway red-flag engine in `lib/clinicalPathways.ts`. |
| `8ebfb94` | Additive chest-pain safety context/resolver, source-aware explicit safety-screen evidence, adaptive fallback, exact eight-phrase regressions, non-chest regressions, and `MAX_DEEP` unresolved-safety handling. |

### 1.4 Doctor workspace, inventory, billing, and state / डॉक्टर workspace

| Commit | Completed work |
| --- | --- |
| `170a8af` | Clinic workflow workspace with dashboard, appointments, patients, inventory, billing, queue, inbox, and follow-up surfaces. |
| `96ae41e` | Inventory catalogue, purchase price, stock ledger, and billing/inventory API and UI updates. |
| `d5948fa` | Prescription inventory UX and workspace routing with Redux store/provider. |
| `b0378d4` | Typed Redux workspace state/hooks, state audit, and URL query synchronization. |

### 1.5 Clinical Report Renderer and verification / report renderer और tests

| Commit | Completed work |
| --- | --- |
| `11aec8c` | Reusable Clinical Report Renderer: parser diagnostics and semantic state, typed IR, safe links, accessible renderer, semantic/state tests, browser/accessibility checks, and test-only host-equivalence validation. |

Renderer pipeline:

```text
raw report + explicit metadata/state
  -> parser diagnostics + semantic state
  -> typed ClinicalReportIR
  -> accessible ClinicalReportRenderer
  -> patient/doctor host surface
```

The renderer preserves wording, qualifiers, citations, source order, links, and explicit priority metadata. It does not infer a warning, red flag, urgency, diagnosis, or treatment from ordinary keywords, bold, or emphasis.

### 1.6 Pre-existing dirty worktree / uncommitted स्थिति

The current worktree also contains files that are not part of the committed delivery above. They are not treated as released functionality in this status report:

- Modified: `components/Header.tsx`, `tsconfig.tsbuildinfo`.
- Untracked: `.kiro/specs/appointment-patient-identity-adaptive-intake/`, `components/DatePicker.tsx`, `components/PatientAutocomplete.tsx`, `components/ReduxProvider.tsx`, `components/TimeSelect.tsx`, `lib/workspaceApi.ts`, `scripts/appointment-bug-condition-exploration.mjs`, `scripts/appointment-bug-condition-fixed-regression.mjs`, `scripts/appointment-task-3-4-contracts.mjs`, `scripts/appointment-task-3-5-contracts.mjs`, `scripts/appointment-task-3-6-tests.mjs`, `scripts/appointment-task-3-7-tests.mjs`, `scripts/audit-frontend-api.mjs`, `scripts/clinical-pathways-task-3-3-tests.mjs`, `scripts/preservation-property-tests.mjs`, and `test-results/`.

This documentation update changes only `README.md` and `docs/PROJECT_STATUS.md`. It does not absorb or modify the worktree files above.

---

## 2. ✅ KYA KIYA HAI (What’s Been Done)

### 2.1 Marketing / Landing Site (100% Complete)

| Page | Route | Status |
| --- | --- | --- |
| Homepage | `/` | ✅ Done |
| Product | `/product` | ✅ Done |
| Workflow | `/workflow` | ✅ Done |
| For Doctors | `/for-doctors` | ✅ Done |
| Security | `/security` | ✅ Done |
| About | `/about` | ✅ Done |
| Contact | `/contact` | ✅ Done |

Core components include Hero, Header, Footer, patient-channel and workflow sections, interactive AI explanation, product features, CTA, demo dialog, and dashboard mockup.

### 2.2 Doctor Workspace (Functional demo)

| Feature | Route/component | Status |
| --- | --- | --- |
| Doctor Workspace | `/demo` → `components/DoctorWorkspace.tsx` | ✅ Done |
| Morning Brief | `/doctor/morning-brief` | ✅ Done |
| Live Queue | `/doctor/queue` | ✅ Done |
| AI Inbox | `/doctor/inbox` | ✅ Done |
| Follow-ups | `/doctor/follow-ups` | ✅ Done |
| Pre-Visit Brief | `components/workspace/PreVisitBrief.tsx` | ✅ Done |
| Prescription Builder + Safety | `components/workspace/PrescriptionBuilder.tsx` | ✅ Done |
| Clinical Report Renderer | `components/clinical-report-renderer/ClinicalReportRenderer.tsx` | ✅ Done |

### 2.3 Patient-facing pages

| Feature | Route | Status |
| --- | --- | --- |
| Patient Portal | `/patient/portal` | ✅ Done |
| Appointment Booking | `/patient/book` | ✅ Done |
| Conversational Appointment + Adaptive Intake | `/patient/appointment` | ✅ Done |
| Smart Intake | `/patient/intake` | ✅ Done |
| Report upload and AI-read findings | `/patient/intake`, `/patient/appointment` | ✅ Done; review-required |

### 2.4 Reception and admin

| Feature | Route | Status |
| --- | --- | --- |
| Reception Check-in | `/reception/checkin` | ✅ Done |
| Admin Analytics | `/admin/analytics` | ✅ Done |

### 2.5 Backend API surface

The repository currently contains 27 route-handler files under `/api`:

- Appointment and patient flow: `/api/appointments`, `/api/appointments/chat`, `/api/patients`, `/api/patients/context`, `/api/pre-visit`, `/api/pre-visit/summary`, `/api/intake`, `/api/intake/next`.
- Doctor workflow: `/api/briefs/morning`, `/api/queue`, `/api/inbox`, `/api/follow-ups`, `/api/referrals`, `/api/communications`, `/api/workspace/actions`, `/api/workspace/summary`.
- Clinical and AI support: `/api/copilot`, `/api/scribe`, `/api/symptom-analysis`, `/api/insights`, `/api/sessions`, `/api/ai-training`.
- Reports and records: `/api/reports/upload`, `/api/medical-records/analyze`, `/api/medical-records/summarize`, `/api/medical-records/reports`.
- Operations: `/api/analytics`, `/api/billing`, `/api/inventory`, `/api/prescriptions`, `/api/profile/settings`.

Routes use the project’s consistent JSON-envelope convention where implemented: `{ ok: boolean, data: T }` for success and `{ ok: false, error: ... }` for errors. API availability does not imply that authentication, tenant isolation, or audit enforcement is complete.

### 2.6 Database and storage

- Local/demo SQLite persistence is stored in `data/ai-upchar.sqlite` and accessed through `app/api/_lib/database.ts`.
- Supabase/Postgres schema and seed are in `supabase/schema.sql` and `supabase/seed.sql`; the migration path was advanced by `71820d0` but is not a completed universal cutover.
- `app/api/_lib/storage.ts` uploads accepted PNG/JPG/WEBP/PDF report files (maximum 20 MB) to the private `patient-reports` bucket and mints short-lived signed URLs.
- Report rows retain `storage_path` and `ai_findings`; the original file remains available to the doctor through a signed link when Storage is configured.
- `.env.example` documents `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and optional `PUTER_API_TOKEN`.

### 2.7 Real AI and report intelligence

Browser-side Puter.js is real AI, not a static mock. `lib/puterClient.ts` uses the end user’s Puter session for fast, reasoning, vision, and research model calls. `lib/clientPrompts.ts` builds clinician-controlled copilot, scribe, report-vision, adaptive-question, research, and pre-visit-report prompts.

The report pipeline is:

1. Patient uploads a PNG/JPG/WEBP/PDF report or prescription.
2. The API stores report metadata and, when configured, the original in private Supabase Storage.
3. Browser vision requests use GPT-4o and Gemini 2.5 Flash; their findings are merged as transcription/organization, not diagnosis.
4. Findings are saved to `reports.ai_findings`, and report-driven adaptive questions may be asked.
5. The pre-visit brief shows intake context, report findings, review notes, and a signed link to the original file.

The server-side AI/hybrid intake foundation remains available as an optional boundary. Puter sign-in and external research can fail; deterministic appointment questions, clinical pathway coverage, red-flag overlays, and doctor-review disclaimers remain the safety-preserving fallback.

### 2.8 Clinical Report Renderer

The renderer is a reusable presentation boundary under:

- `lib/clinical-report-renderer/types.ts` — typed input, IR, metadata, block, citation, source, state, and link contracts.
- `lib/clinical-report-renderer/parser.ts` — Markdown/structure parsing, diagnostics, safe-link handling, and semantic state.
- `lib/clinical-report-renderer/index.ts` — public exports.
- `components/clinical-report-renderer/ClinicalReportRenderer.tsx` — accessible semantic renderer.
- `components/clinical-report-renderer/clinical-report-renderer.css` — renderer layout and priority treatments.

The parser produces a typed IR before presentation. It preserves source text and explicit metadata, supports readable fallback for malformed input, distinguishes `empty`, `error`, `fallback`, and `ready`, and never invents clinical content. Renderer validation includes semantic/state tests, contract/property runs, browser verification, accessibility, safe-link behavior, and a test-only second host.

---

## 3. Current clinical-safety architecture / वर्तमान clinical safety

The chest change is additive. It does not replace the general pathway matcher or turn pathway recognition into diagnosis.

### 3.1 Resolution and route modes

- `matchPathway(complaint, extra?)` remains the compatible curated API.
- `assessChestSafety(complaint, extra?)` recognizes a bounded chest location/quality combination, including reviewed English, Roman Hindi/Hinglish, and Unicode variants for pain, pressure, heaviness, burning, and tightness.
- `resolveClinicalContext(complaint, extra?)` combines the ordinary pathway result and chest assessment.
- The context route is one of `curated_pathway`, `chest_safety_fallback`, or `generic_fallback`.
- `pathwayForClinicalContext()` can reuse the reviewed `chest_pain` pathway as a safety profile even when the ordinary matcher returned `null`.
- Standalone `chest`, `seene`, `dard`, `pain`, `pressure`, `left`, or `baaye` do not create a chest route, and non-chest controls retain their existing pathways.

### 3.2 Explicit safety-evidence boundary

- Complaint text is context. It may raise an explainable signal for clinician visibility, but complaint wording never completes `red_flag_screen`.
- `coverageFor()` and `evaluateSafetyEvidence()` use source-attributed evidence. Only a targeted answer/structured safety answer with the `red_flag_screen` dimension can complete the screen.
- Clear negative targeted answers become `negative`; clear affirmative answers with recognized signals become `positive`; missing, ambiguous, off-topic, or contradictory answers remain `unanswered`/`uncertain`.
- Existing pathway/general red-flag meanings and urgency values are retained. Emergency signals sort before urgent signals, and the final overlay can raise AI urgency to the deterministic worst signal but cannot lower it.
- `MAX_DEEP` remains a ceiling, not a completion condition. If safety remains unresolved at the ceiling, the snapshot/report states that clinician review is required.

The system still does not diagnose, prescribe, or issue autonomous emergency/treatment decisions. The safety layer ensures that the doctor sees the signal and the missing evidence.

---

## 4. Architecture snapshot / architecture स्थिति

The current implementation is a Next.js modular monolith with client pages, direct API routes, local/demo SQLite, Supabase/Postgres integration paths, private Storage, and browser AI. The target architecture in `docs/ARCHITECTURE.md`—AI Gateway, tenant boundary, asynchronous jobs, retrieval, PostgreSQL-first persistence, and complete audit/governance—is **recommended future architecture**, not current production completion.

```text
Browser UI
├── Doctor workspace + patient routes
├── PuterLoginGate → optional Puter.js User-Pays AI
├── deterministic/degraded fallback
└── Next.js API routes
    ├── local SQLite demo persistence
    ├── Supabase/Postgres integration path
    └── private Supabase Storage + signed report URLs

Appointment route
└── fixed identity/scheduling
    → resolveClinicalContext
    → adaptive coverage
    → explicit safety evidence
    → snapshot/report overlay
    → pre-visit + appointment + transcript persistence
```

---

## 5. State boundaries and Redux / state सीमा

Redux is mounted at the doctor demo boundary by `components/WorkspaceReduxProvider.tsx`. It stores only cross-workspace coordination state:

- `workspace.activeNav`: selected doctor workspace screen, synchronized with the `screen` query parameter.
- `workspace.selectedPatientId`: opaque selected-patient ID shared by shell and patient panels.

The following intentionally remain local or API-owned: appointment answers and transcript, deep-question counters, uploads and report findings, prescription letter drafts, inventory/appointment/billing/dashboard responses, patient details, AI summaries, filters, expanded panels, and request state. Sensitive clinical content is not placed in a global Redux cache. See [docs/redux-state-audit.md](redux-state-audit.md).

---

## 6. Persistence, deployment, and security reality / वर्तमान सीमाएँ

### Current paths

- **Local/demo:** `data/ai-upchar.sqlite` through `app/api/_lib/database.ts`; this file is ignored by Git.
- **Hosted database path:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` support Supabase/Postgres integration. `supabase/schema.sql` is the generated schema source; it includes patients, appointments, reports, AI outputs, inventory, billing, messages, consent, and audit tables.
- **Report files:** `app/api/_lib/storage.ts` uses the server-only service-role key for the private `patient-reports` bucket. It enforces the current MIME allowlist and 20 MB limit and issues signed URLs that default to one hour.
- **Browser AI:** Puter.js uses the end user’s browser session. `PUTER_API_TOKEN` is optional server-side configuration and must not be sent to the client.

### Production blockers still open

- Real authentication, MFA, session management, and RBAC for Doctor, Reception, Care staff, Clinic admin, and Patient roles.
- End-to-end clinic tenant isolation and patient-scope authorization on every protected API route.
- Active immutable audit logging. The schema/table foundation exists, but complete action logging and review governance are not activated everywhere.
- Full SQLite-to-Postgres migration, deployment secrets, backups, monitoring, rate limits, and disaster recovery.
- Real WhatsApp/SMS/email dispatch, voice/telephony, vitals devices, consent UI, ABDM/ABHA, lab/pharmacy integrations, and payment gateway.
- Broader natural-language coverage beyond reviewed pathway anchors. Keyword matching cannot replace clinician review.
- Live Puter session/model availability and web research reliability; degraded mode remains necessary.

`docs/ARCHITECTURE.md` should be read as a target/recommended production design. It must not be used as evidence that the current demo already has an authenticated AI Gateway, full tenant isolation, or complete audit controls.

---

## 7. Validation and test status / परीक्षण स्थिति

### Current validation results

- Chest pathway/safety harness: **12/12 checks passed**.
- Adaptive appointment harness: **8/8 checks passed**.
- Clinical Report Renderer semantic/state suite: **10/10 passed**.
- Clinical Report Renderer contract/property suite: **100 iterations per property passed**.
- `npm run lint`: passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm run build`: passed.
- Renderer browser/accessibility/host-equivalence validation was delivered with the renderer work. Browser smoke and Puter degraded-mode checks remain separate environment-sensitive checks because browser engine and external Puter availability can vary.
- **Known legacy drift:** `scripts/clinical-pathways-task-3-3-tests.mjs` still targets an older `clinicalPathways` contract. It remains drifted and was not fixed as part of the chest-pain work or this documentation update. Do not use it to contradict the current 12/12 chest harness.

### Exact single-run commands

```bash
npm run lint
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:appointment-adaptive-interview
node --experimental-strip-types scripts/chest-pain-pathway-matching-tests.mjs
npm run test:clinical-report-renderer:semantic
npm run test:clinical-report-renderer
```

Renderer browser suites are under `tests/clinical-report-renderer/` and are separate from the Node command list. When browser smoke is run, verify both the normal Puter-connected path and the optional/degraded path; a missing Puter session must not remove the deterministic appointment/safety workflow.

---

## 8. ⏳ KYA KARNA BAAKI HAI (What Remains)

### 8.1 P0 — Critical production blockers

- [ ] **Authentication & Authorization** — MFA, role-based access control, session management, and explicit clinic/patient scope checks. The current demo has no complete application auth boundary.
- [ ] **Multi-tenant isolation** — clinic-level data separation and authorization on every protected operation.
- [ ] **Audit logging activation** — immutable logs for clinical actions, AI output, review, edit, sign, and share events.
- [ ] **Production persistence cutover** — complete and verify the SQLite-to-Postgres migration, backups, monitoring, and recovery.

### 8.2 P1 — Important integrations

- [ ] **Real communication dispatch** — WhatsApp/SMS/email provider integration; current communication workflows remain draft/simulated.
- [x] **Document upload and AI reading** — Supabase private Storage plus GPT-4o/Gemini browser vision findings are implemented; clinician verification remains required.
- [ ] **Voice call intake** — UI concept exists; real telephony/IVR is pending.
- [ ] **Vitals device integration** — manual data paths exist; device adapters are pending.
- [ ] **Consent management workflow** — schema foundations exist; complete consent UI/policy enforcement is pending.

### 8.3 P2 — Future capabilities

- [ ] ABDM/ABHA integration
- [ ] Hospital information system adapters
- [ ] Laboratory and pharmacy integrations
- [ ] Payment gateway
- [ ] Enterprise SSO
- [ ] Offline mode for poor connectivity
- [ ] Multilingual voice scribe

### 8.4 Technical debt and quality

- [ ] Expand unit, integration, API-contract, and end-to-end coverage beyond the targeted harnesses.
- [ ] Keep browser smoke/degraded-mode checks in CI or release validation where external prerequisites are available.
- [ ] Reconcile or retire the drifted `scripts/clinical-pathways-task-3-3-tests.mjs` rather than weakening the current safety harness.
- [ ] Address remaining minor lint/type-loader notes when they are isolated from the committed feature work.
- [ ] Add broader error boundaries and production observability across all routes.

---

## 9. 💡 KYU KIYA (Why These Decisions)

### 9.1 Browser-side Puter User-Pays AI

Puter browser calls let each end user connect their own session without putting a model key in the browser application. The login gate connects AI up front, while optional degraded mode prevents AI availability from blocking basic appointment capture.

### 9.2 SQLite + Supabase/Postgres migration path

SQLite keeps the local demo fast and low-friction. Supabase/Postgres and Storage provide a hosted path for durable data and private report files. The two paths are intentionally documented as current integration/deployment stages, not falsely presented as a finished single-store production architecture.

### 9.3 Adaptive intake and reviewed pathways

The pathway library supplies a consistent reviewed starting frame. Coverage tracks history dimensions rather than forcing every patient through one questionnaire. AI can choose or phrase the next question, but deterministic fallback and safety evidence prevent an AI failure or early `STOP` from silently erasing required review context.

### 9.4 Source-aware safety evidence

Complaint context and explicit safety answers are different kinds of evidence. The chest resolver can route a meaningful chest complaint to the right safety profile, while only an attributable targeted answer can complete `red_flag_screen`. This avoids treating the word “chest” or “seene” as a confirmed negative or positive danger-screen response.

### 9.5 Clinical Report Renderer as a presentation boundary

Parsing into a typed IR before rendering makes source order, citations, safe links, explicit priority, fallback diagnostics, and host equivalence testable. It also keeps presentation from inventing clinical meaning or coupling report display to fetching, generation, or diagnosis logic.

### 9.6 Redux only for coordination state

Only navigation and opaque patient selection cross doctor-workspace boundaries in the current UI. Keeping sensitive conversation and API responses local reduces stale global copies and limits the amount of clinical content retained in client-wide state.

---

## 10. Core principles / मूल सिद्धांत

1. **AI assists. Clinicians decide.**
2. **Explicit approval** for prescriptions, record changes, referrals, and patient-facing clinical communication.
3. **Source provenance** for AI/report content wherever available.
4. **Patient safety first** through deterministic checks and visible unresolved states.
5. **Privacy by design** through data minimization, private files, and signed URLs.
6. **Audit everything** once the production audit boundary is activated.
7. **Graceful degradation** when AI, research, storage, or integrations are unavailable.
8. **Multilingual and accessible** patient/clinician experiences.
9. **Workflow-native AI** rather than autonomous action.
10. **Longitudinal thinking** across appointments, reports, notes, and follow-ups.

No current feature should be described as autonomous diagnosis, autonomous treatment, autonomous prescribing, or an approved patient instruction without clinician review.

---

**Maintainer:** AI UPCHAR Product Team
**Related docs:** [README.md](../README.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/redux-state-audit.md](redux-state-audit.md)
