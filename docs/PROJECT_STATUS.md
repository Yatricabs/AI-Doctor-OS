# AI UPCHAR — Project Status / परियोजना स्थिति

**Last Updated:** 2026-09-12
**Version:** v2.0
**Live Demo:** https://aiupchar.com/demo

> यह document batata hai ki **kya kiya hai**, **kya karna baaki hai**, aur **jo kiya hai vo kyu kiya hai**.
> (This document explains what has been done, what remains, and why the decisions were made.)

---

## 1. Executive Summary / सारांश

AI UPCHAR ek **patient-to-provider orchestration platform** hai jo Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, aur SQLite (better-sqlite3) par bana hai. Supabase (PostgreSQL) production persistence ke liye connected hai.

Core principle: **"AI assists. Clinicians decide."** — AI kabhi bhi apne aap diagnose, prescribe, ya patient ko message nahi karta. Har clinical action ke liye doctor ki explicit approval zaroori hai.

---

## 2. ✅ KYA KIYA HAI (What's Been Done)

### 2.1 Marketing / Landing Site (100% Complete)
| Page | Route | Status |
|------|-------|--------|
| Homepage | `/` | ✅ Done |
| Product | `/product` | ✅ Done |
| Workflow | `/workflow` | ✅ Done |
| For Doctors | `/for-doctors` | ✅ Done |
| Security | `/security` | ✅ Done |
| About | `/about` | ✅ Done |
| Contact | `/contact` | ✅ Done |

**Components built:** Hero, Header, Footer, PatientChannelsSection, WorkflowSection, InteractiveEngineSection, ProblemsSection, FeaturesGrid, CTASection, DemoDialog, DashboardMockup.

### 2.2 Doctor Workspace (Demo — Functional)
| Feature | Route/Component | Status |
|---------|-----------------|--------|
| Doctor Workspace | `/demo` → `DoctorWorkspace.tsx` | ✅ Done |
| Morning Brief | `/doctor/morning-brief` | ✅ Done |
| Live Queue | `/doctor/queue` | ✅ Done |
| AI Inbox | `/doctor/inbox` | ✅ Done |
| Follow-ups | `/doctor/follow-ups` | ✅ Done |
| Pre-Visit Brief | `components/workspace/PreVisitBrief.tsx` | ✅ Done |
| Prescription Builder + Safety | `components/workspace/PrescriptionBuilder.tsx` | ✅ Done |

### 2.3 Patient-Facing Pages
| Feature | Route | Status |
|---------|-------|--------|
| Patient Portal | `/patient/portal` | ✅ Done |
| Appointment Booking | `/patient/book` | ✅ Done (multi-step) |
| Smart Intake | `/patient/intake` | ✅ Done |

### 2.4 Reception & Admin
| Feature | Route | Status |
|---------|-------|--------|
| Reception Check-in | `/reception/checkin` | ✅ Done |
| Admin Analytics | `/admin/analytics` | ✅ Done |

### 2.5 Backend API Routes (23 endpoints)
All routes use the `{ ok: boolean, data: T }` response envelope.

| API | Methods | Purpose |
|-----|---------|---------|
| `/api/appointments` | GET, POST | Appointment booking & listing |
| `/api/queue` | GET, POST | Queue management & priority |
| `/api/intake` | GET, POST | Smart patient intake |
| `/api/pre-visit` | GET, POST | Pre-visit brief generation |
| `/api/prescriptions` | GET, POST | Prescription draft/sign/dispatch |
| `/api/referrals` | GET, POST | Referral management |
| `/api/follow-ups` | GET, POST | Follow-up tracking |
| `/api/inbox` | GET, POST | AI inbox for tasks/results |
| `/api/communications` | GET, POST | Message dispatch (WhatsApp/SMS/email) |
| `/api/briefs/morning` | GET | Morning brief |
| `/api/analytics` | GET | Clinic metrics |
| `/api/patients` | GET, POST | Patient records |
| `/api/patients/context` | GET | Full patient context |
| `/api/copilot` | POST | AI clinical assistant (demo) |
| `/api/scribe` | POST | Voice clinical notes (demo) |
| `/api/symptom-analysis` | POST | Symptom analysis (demo) |
| `/api/medical-records/*` | POST | Report analyze/summarize/reports |
| `/api/insights` | POST | Clinical insights |
| `/api/sessions` | POST | AI sessions |
| `/api/workspace/actions` | POST | Workspace actions |

### 2.6 Database (SQLite + Supabase)
- **35+ tables** defined in `app/api/_lib/database.ts`
- Seed data for demo: patients, reports, insights, appointments, queue, medications, allergies, conditions, follow-ups, referrals, diagnostic orders, inbox items, drug interactions.
- Supabase REST API sync for production persistence.

### 2.7 Recent Fixes (Git History)
1. `c290890` — Exported `insert, update, remove` from demo.ts (build fix)
2. `6831da5` — Imported `remove` from database.ts (build fix)
3. `f873f40` — Straightened Hero section badge alignment
4. `f6812c8` — Added favicon + SEO metadata
5. `3499796` — Added error handling to pre-visit API
6. `6e22133` — Implemented patient portal, booking flow, error boundary

---

## 3. ⏳ KYA KARNA BAAKI HAI (What Remains)

### 3.1 P0 — Critical (Production Blockers)
- [ ] **Authentication & Authorization** — MFA, role-based access control (Doctor/Reception/Staff/Admin/Patient), session management. Abhi koi real auth nahi hai.
- [ ] **Real AI Integration** — Copilot, scribe, symptom analysis abhi demo/mock hai. Gemini/OpenAI integrate karna baaki.
- [ ] **Multi-tenant Isolation** — Clinic-level data separation abhi nahi hai.
- [ ] **Audit Logging** — Table defined hai par active logging implement nahi hui.

### 3.2 P1 — Important
- [ ] **Real Communication Dispatch** — WhatsApp/SMS/email abhi simulate hota hai. Twilio/WhatsApp Business API integrate karna hai.
- [ ] **Document Upload & OCR** — File upload UI hai par actual storage + text extraction baaki.
- [ ] **Voice Call Intake** — UI mockup hai, real telephony (voice IVR) baaki.
- [ ] **Vitals Device Integration** — Manual entry possible, device integration nahi.
- [ ] **Consent Management** — Table hai, workflow UI baaki.

### 3.3 P2 — Nice to Have (Future)
- [ ] ABDM/ABHA integration (India health records)
- [ ] Hospital Information System (HIS) adapters
- [ ] Lab & Pharmacy system integration
- [ ] Payment gateway
- [ ] Enterprise SSO
- [ ] Offline mode for poor connectivity
- [ ] Multilingual voice scribe

### 3.4 Technical Debt
- [ ] SQLite → PostgreSQL full migration (abhi hybrid hai)
- [ ] Remaining `useEffect` dependency warnings (minor lint)
- [ ] Unit + integration tests (koi test suite nahi hai abhi)
- [ ] Error boundary sirf demo page par hai, saare pages par chahiye

---

## 4. 💡 KYU KIYA (Why These Decisions)

### 4.1 SQLite + Supabase Hybrid — Kyu?
**Decision:** Local SQLite (better-sqlite3) primary DB, Supabase REST API for sync.
**Reason:** SQLite fast development aur zero-config demo ke liye perfect hai. Supabase production persistence deta hai bina heavy setup ke. Isse demo turant chalta hai aur production-ready path bhi maintain rehta hai.
*(Content was rephrased for compliance with licensing restrictions)*

### 4.2 `{ ok, data }` Response Envelope — Kyu?
**Decision:** Har API `{ ok: boolean, data: T }` ya `{ ok: false, error: {...} }` return karti hai.
**Reason:** Consistent frontend error handling. Component sirf `payload.ok` check karke data ya error dikha sakta hai. Predictable contract se bugs kam hote hain.

### 4.3 Demo-Level AI (Mock) — Kyu?
**Decision:** Copilot, scribe, symptom analysis abhi rule-based/mock responses dete hain.
**Reason:** UI/UX aur workflow pehle validate karna zaroori tha bina API cost aur latency ke. Real AI baad mein plug karna aasaan hai kyunki interface already defined hai.

### 4.4 Error Boundary on Demo Page — Kyu?
**Decision:** Demo page ko `ErrorBoundary` component se wrap kiya.
**Reason:** Demo public-facing hai. Agar koi API fail ho (jaise pre-visit ka DOCTYPE JSON error tha), to poora page crash na ho — user ko graceful "refresh" option mile. Yeh professional impression banaye rakhta hai.

### 4.5 Hero Badge Rotation Hataya — Kyu?
**Decision:** Feature badges se `rotate` classes remove ki.
**Reason:** User feedback: badges "tedha" (crooked) dikh rahe the. Rotation stylistic tha par misaligned lag raha tha. Straight alignment cleaner aur professional lagta hai.

### 4.6 Server-Side try-catch in APIs — Kyu?
**Decision:** Pre-visit API (aur baaki) mein try-catch wrap kiya jo `error(...)` JSON return kare.
**Reason:** Bina try-catch ke, server crash hone par Next.js HTML error page bhejta tha. Frontend `res.json()` karta to "Unexpected token '<'" error aata. try-catch se hamesha valid JSON milta hai.

### 4.7 Multi-channel Access (WhatsApp/Voice/App/Web) — Kyu?
**Decision:** Patient intake 4 channels se possible design kiya.
**Reason:** India mein har patient ke paas smartphone/app nahi hota. WhatsApp har family use karti hai, aur voice call literacy/smartphone barrier hata deta hai. Government hospital + rural reach ke liye zaroori.

---

## 5. 🏗️ Architecture Snapshot

```
Frontend (Next.js App Router)
├── Marketing pages (/, /product, /workflow, ...)
├── Doctor workspace (/demo, /doctor/*)
├── Patient pages (/patient/portal, /patient/book, /patient/intake)
├── Reception (/reception/checkin)
└── Admin (/admin/analytics)

Backend (Next.js API Routes)
├── 23 REST endpoints under /api/*
├── Response envelope: { ok, data }
└── Shared helpers in /api/_lib/demo.ts + database.ts

Database
├── SQLite (data/ai-upchar.sqlite) — primary
├── 35+ tables (patients, appointments, queue, prescriptions, ...)
└── Supabase (PostgreSQL) — production sync
```

---

## 6. 🎯 Next Immediate Steps (Priority Order)

1. **Authentication** — NextAuth.js ya Supabase Auth setup karo (roles ke saath)
2. **Real AI** — Gemini API ko copilot/scribe/symptom routes mein connect karo
3. **Document upload** — Supabase Storage + text extraction
4. **Real messaging** — WhatsApp Business API / Twilio integrate karo
5. **Testing** — Vitest + Playwright setup karo
6. **Audit logging** — Har clinical action log karo

---

## 7. 🚨 Core Principles (Kabhi Na Toota Jaaye)

1. **AI assists. Clinicians decide.** — Koi autonomous clinical action nahi
2. **Explicit approval** — Har action doctor sign-off maange
3. **Source provenance** — AI output kahan se aaya, dikhao
4. **Patient safety first** — Multi-layer medication safety checks
5. **Privacy by design** — Consent-based processing
6. **Audit everything** — Immutable clinical trail
7. **Graceful degradation** — AI fail ho to bhi system chale
8. **Multilingual & accessible** — Diverse patients ko support
9. **Workflow-native AI** — AI natural workflow mein embed ho
10. **Longitudinal thinking** — Patient story time ke saath banaye

---

**Maintainer:** AI UPCHAR Product Team
**Related Docs:** `ARCHITECTURE.md`, `V2_IMPLEMENTATION_PLAN.md`
