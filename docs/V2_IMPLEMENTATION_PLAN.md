# AI UPCHAR v2.0 Implementation Plan

**Created:** 2026-09-11  
**Status:** Planning Phase  
**Goal:** Transform AI UPCHAR from doctor-only workspace to patient-to-provider orchestration platform

---

## Executive Summary

Current system is a **doctor-focused workspace** with demo features.  
New architecture defines a **complete patient-to-provider orchestration platform** covering:
- Pre-visit patient intake and preparation
- During-visit clinical assistance
- Post-visit care continuity

---

## 📊 GAP ANALYSIS: Current vs v2.0

### ✅ Already Implemented (Current System)
1. Doctor workspace with patient context
2. AI Clinical Copilot (demo)
3. Medical scribe functionality (demo)
4. Report analysis (demo)
5. Prescription interface (demo)
6. Basic patient timeline
7. Marketing/landing pages
8. SQLite database foundation
9. Basic API structure

### ❌ Missing (Required by v2.0)

#### **CRITICAL - P0 (Must Have)**

##### 1. **Patient Access & Appointment Orchestration** (Section 7)
- [ ] Multi-channel patient access (WhatsApp, Web, Mobile, Voice)
- [ ] Patient identity & consent management
- [ ] Appointment booking and orchestration
- [ ] Visit type classification (new complaint, follow-up, routine, etc.)
- [ ] Smart intake question engine (adaptive based on visit type)
- [ ] Document intake with classification
- [ ] Patient/caregiver proxy model

##### 2. **Pre-Visit Intelligence** (Section 8)
- [ ] Pre-visit patient brief generation
- [ ] Visit reason capture and classification
- [ ] Patient history integration
- [ ] Medication reconciliation
- [ ] Document status tracking
- [ ] Change detection ("What Changed")
- [ ] Missing information identification
- [ ] Attention signals/safety flags
- [ ] Patient questions tracking

##### 3. **Queue & Priority Management** (Section 9)
- [ ] Live queue engine
- [ ] Priority classification system (URGENT/HIGH/ROUTINE/FOLLOW-UP/ADMIN)
- [ ] Patient ETA calculation
- [ ] Check-in system
- [ ] Walk-in support
- [ ] Token-based queue for government hospitals
- [ ] Queue status for patients and doctors
- [ ] Department-wise queue management

##### 4. **Enhanced Doctor Workspace** (Section 10)
- [ ] Patient header with identity, visit type, priority, queue status
- [ ] Structured patient context panel (history, conditions, meds, allergies, reports, timeline)
- [ ] Clinical workspace with chief complaint, vitals, assessment, plan
- [ ] Voice/scribe integration (consent-aware)
- [ ] Enhanced AI Copilot with:
  - What changed comparison
  - Missing information detection
  - Report comparison
  - Safety alerts
  - Clinical considerations with provenance
- [ ] Source/provenance display for AI outputs

##### 5. **Safety & Approval Gate** (Section 12)
- [ ] Medication safety checks:
  - Allergy checks
  - Drug interaction detection
  - Duplication detection
  - Dose validation
  - Renal/hepatic considerations
- [ ] Explicit review → approve/sign → dispatch workflow
- [ ] Structured prescription builder
- [ ] Safety alert system with acknowledgement

##### 6. **Post-Visit & Care Continuity** (Section 13)
- [ ] Care Continuity Engine
- [ ] Follow-up tracking and reminders
- [ ] Lab/imaging order tracking
- [ ] Result notification system
- [ ] Referral management with status tracking
- [ ] Approved patient instructions dispatch
- [ ] AI Inbox for overdue/exception work
- [ ] Next-visit memory system

##### 7. **Authentication & Authorization**
- [ ] Multi-factor authentication (MFA)
- [ ] Role-based access control (Doctor, Reception, Staff, Admin, Patient)
- [ ] Tenant/clinic isolation
- [ ] Patient-level authorization
- [ ] Audit logging system

##### 8. **Communication System** (Section 7.1)
- [ ] WhatsApp integration for patient communication
- [ ] SMS notifications
- [ ] Email notifications
- [ ] Push notifications (mobile)
- [ ] Voice call integration
- [ ] Approved message dispatch only

#### **IMPORTANT - P1 (Should Have)**

##### 9. **Special Scenarios** (Section 14)
- [ ] Emergency pathway routing
- [ ] Walk-in patient flow
- [ ] Returning patient pre-fill
- [ ] Child patient with guardian consent
- [ ] Elderly/caregiver-assisted mode
- [ ] Multilingual support (UI, text, voice)
- [ ] Low literacy mode (voice, icons, staff-assisted)
- [ ] Poor connectivity offline mode
- [ ] Duplicate identity resolution
- [ ] Doctor rescheduling/absence handling
- [ ] Department transfer with context preservation
- [ ] Multi-doctor care coordination
- [ ] Report arrival after visit handling
- [ ] Medication refill workflow
- [ ] Patient clinic/hospital transfer with consent
- [ ] Conflicting records resolution

##### 10. **Enhanced Clinical Features**
- [ ] Vitals capture (manual + device integration)
- [ ] Structured findings entry
- [ ] Versioned clinical events (no destructive overwrites)
- [ ] Clinical decision support with provenance
- [ ] Report intelligence with extraction and comparison
- [ ] Orders/diagnostic workflow
- [ ] Referral package creation

##### 11. **Patient Portal**
- [ ] Patient appointment booking
- [ ] Document upload
- [ ] Prescription viewing
- [ ] Report access
- [ ] Follow-up reminders
- [ ] Medication instructions
- [ ] Care plan viewing

##### 12. **Reception/Staff Workspace**
- [ ] Registration interface
- [ ] Check-in system
- [ ] Queue management
- [ ] Assisted intake for low-literacy patients
- [ ] Token generation
- [ ] Department routing

##### 13. **Analytics & Governance** (Section 29)
- [ ] Booking completion metrics
- [ ] Wait time analytics
- [ ] Doctor efficiency metrics
- [ ] Clinical readiness metrics
- [ ] Safety alert tracking
- [ ] Queue delay monitoring
- [ ] Follow-up completion tracking
- [ ] AI quality metrics (acceptance/rejection rates)

#### **NICE TO HAVE - P2 (Future)**

##### 14. **Advanced Features**
- [ ] Multilingual ambient scribe
- [ ] Validated dosing guardrails
- [ ] Image measurement assistance
- [ ] Chronic care pathways
- [ ] ABDM integration (India's health records system)
- [ ] Multi-site orchestration
- [ ] Hospital Information System (HIS) adapters
- [ ] Lab system integration
- [ ] Pharmacy integration
- [ ] Payment gateway
- [ ] Enterprise SSO

##### 15. **Interoperability** (Section 20)
- [ ] ABDM/ABHA consent-aware adapter
- [ ] Hospital Information System integration
- [ ] Lab results integration
- [ ] Pharmacy integration
- [ ] Messaging provider abstraction
- [ ] Payment gateway adapter
- [ ] Identity system integration

---

## 🎯 NEW PROBLEM STATEMENTS ADDRESSED

### Patient-Side Problems (v2.0 Section 3)
1. **Finding right service** - Directory of departments, specialties, doctors
2. **Booking friction** - Multi-channel easy booking
3. **History recall** - Automated capture and storage
4. **Document fragmentation** - Centralized document vault
5. **Symptom explanation** - Voice/text guided intake
6. **Language barriers** - Multilingual support
7. **Uncertain waiting time** - Live ETA updates
8. **Repeated forms** - Smart pre-fill for returning patients
9. **Caregiver complexity** - Proxy authorization model
10. **Post-visit confusion** - Clear approved instructions
11. **Loss of continuity** - Longitudinal patient record

### Doctor-Side Problems (v2.0 Section 4)
1. **Before clinic** - Morning brief with workload preview
2. **Before each patient** - Pre-visit intelligent brief
3. **During history** - Pre-captured intake reduces repetition
4. **During examination** - Structured vitals/findings capture
5. **During reasoning** - AI copilot with integrated context
6. **During documentation** - Voice scribe assistance
7. **During prescribing** - Comprehensive safety checks
8. **During communication** - Draft patient instructions
9. **After visit** - Automated task/follow-up tracking
10. **Across handoffs** - Context preservation in referrals
11. **At scale** - Adaptive to different volumes/settings

### Safety Problems (v2.0 Section 5)
1. **Medication errors** - Multi-layer safety checks
2. **Diagnostic-context gaps** - Surface relevant history automatically
3. **Handoffs** - Package full context with uncertainty
4. **Documentation mismatch** - Clear labeling of AI vs human content
5. **Patient communication errors** - Approved-only dispatch
6. **Alert fatigue** - High-signal prioritized alerts
7. **Identity mismatch** - Explicit resolution required

---

## 🏗️ NEW ARCHITECTURAL COMPONENTS

### Frontend (New Pages/Components Required)

#### Patient-Facing
- [ ] `/patient/book` - Appointment booking
- [ ] `/patient/intake` - Smart intake questionnaire
- [ ] `/patient/upload` - Document upload
- [ ] `/patient/queue` - Queue status and ETA
- [ ] `/patient/dashboard` - Patient portal
- [ ] `/patient/appointments` - Appointment history
- [ ] `/patient/prescriptions` - Prescription access
- [ ] `/patient/reports` - Report viewing

#### Doctor-Facing (Enhancements)
- [ ] `/doctor/morning-brief` - Daily workload summary
- [ ] `/doctor/queue` - Live queue with priorities
- [ ] `/doctor/workspace/[patientId]/pre-visit` - Pre-visit brief
- [ ] `/doctor/workspace/[patientId]/consultation` - Enhanced consultation
- [ ] `/doctor/workspace/[patientId]/prescription` - Enhanced Rx builder
- [ ] `/doctor/inbox` - AI Inbox for tasks/results
- [ ] `/doctor/followups` - Follow-up management

#### Reception/Staff
- [ ] `/reception/checkin` - Patient check-in
- [ ] `/reception/queue` - Queue management
- [ ] `/reception/registration` - New patient registration
- [ ] `/reception/assisted-intake` - Staff-assisted intake

#### Admin
- [ ] `/admin/analytics` - Clinic metrics
- [ ] `/admin/users` - User management
- [ ] `/admin/settings` - Clinic configuration
- [ ] `/admin/audit` - Audit logs

### Backend (New API Routes Required)

#### Patient & Appointments
- [ ] `POST /api/v1/patients/identity` - Identity resolution
- [ ] `POST /api/v1/patients/consent` - Consent management
- [ ] `GET /api/v1/appointments/availability` - Slot availability
- [ ] `POST /api/v1/appointments/book` - Book appointment
- [ ] `PUT /api/v1/appointments/:id/reschedule` - Reschedule
- [ ] `POST /api/v1/intake/start` - Start intake session
- [ ] `POST /api/v1/intake/question` - Answer intake question
- [ ] `POST /api/v1/intake/document` - Upload document
- [ ] `GET /api/v1/intake/:id/status` - Intake completion

#### Queue Management
- [ ] `POST /api/v1/queue/checkin` - Patient check-in
- [ ] `GET /api/v1/queue/:facility/status` - Queue status
- [ ] `GET /api/v1/queue/patient/:id/eta` - Patient ETA
- [ ] `PUT /api/v1/queue/:id/priority` - Update priority
- [ ] `POST /api/v1/queue/token` - Generate token

#### Pre-Visit Intelligence
- [ ] `GET /api/v1/visits/:id/brief` - Pre-visit brief
- [ ] `GET /api/v1/visits/:id/what-changed` - Change detection
- [ ] `GET /api/v1/visits/:id/missing-info` - Missing information
- [ ] `GET /api/v1/visits/:id/attention-signals` - Safety signals

#### Safety & Prescriptions
- [ ] `POST /api/v1/prescriptions/draft` - Create draft
- [ ] `POST /api/v1/prescriptions/:id/safety-check` - Run safety checks
- [ ] `POST /api/v1/prescriptions/:id/sign` - Explicit sign-off
- [ ] `GET /api/v1/safety/interactions` - Drug interactions
- [ ] `GET /api/v1/safety/allergies` - Allergy check

#### Care Continuity
- [ ] `POST /api/v1/followups/create` - Create follow-up
- [ ] `GET /api/v1/followups/due` - Due follow-ups
- [ ] `POST /api/v1/orders/create` - Lab/imaging order
- [ ] `GET /api/v1/orders/:id/results` - Order results
- [ ] `POST /api/v1/referrals/create` - Create referral
- [ ] `GET /api/v1/referrals/:id/status` - Referral status
- [ ] `GET /api/v1/inbox` - AI Inbox items
- [ ] `POST /api/v1/inbox/:id/resolve` - Resolve inbox item

#### Communication
- [ ] `POST /api/v1/comms/whatsapp` - Send WhatsApp
- [ ] `POST /api/v1/comms/sms` - Send SMS
- [ ] `POST /api/v1/comms/email` - Send email
- [ ] `GET /api/v1/comms/:id/status` - Delivery status

#### Briefs
- [ ] `GET /api/v1/briefs/morning` - Morning brief
- [ ] `GET /api/v1/briefs/closing` - Closing brief
- [ ] `GET /api/v1/briefs/workload` - Current workload

### Database Schema Additions

#### New Tables Required
```sql
-- Identity & Consent
CREATE TABLE patient_identities (...)
CREATE TABLE consents (...)
CREATE TABLE proxy_relationships (...)

-- Appointments & Queue
CREATE TABLE appointment_slots (...)
CREATE TABLE visit_types (...)
CREATE TABLE queue_entries (...)
CREATE TABLE priority_overrides (...)
CREATE TABLE tokens (...)

-- Intake
CREATE TABLE intake_sessions (...)
CREATE TABLE intake_responses (...)
CREATE TABLE smart_questions (...)

-- Pre-Visit
CREATE TABLE pre_visit_briefs (...)
CREATE TABLE attention_signals (...)
CREATE TABLE missing_information (...)

-- Safety
CREATE TABLE medication_checks (...)
CREATE TABLE drug_interactions (...)
CREATE TABLE allergy_records (...)
CREATE TABLE safety_alerts (...)

-- Care Continuity
CREATE TABLE follow_ups (...)
CREATE TABLE diagnostic_orders (...)
CREATE TABLE referrals (...)
CREATE TABLE care_tasks (...)
CREATE TABLE inbox_items (...)

-- Communication
CREATE TABLE message_queue (...)
CREATE TABLE notification_log (...)
CREATE TABLE communication_preferences (...)

-- Analytics
CREATE TABLE workflow_metrics (...)
CREATE TABLE ai_quality_metrics (...)
```

---

## 🔄 KEY WORKFLOW CHANGES

### OLD FLOW (Current)
```
Login → Dashboard → Open Patient → View Demo → Done
```

### NEW FLOW (v2.0)
```
PATIENT SIDE:
Intent → Multi-channel Access → Identity/Consent → Appointment Booking 
→ Smart Intake → Document Upload → Queue Status → Receive ETA

DOCTOR SIDE:
Login → Morning Brief → Queue View → Pre-Visit Brief → Patient Context 
→ Consultation (with Scribe/Copilot) → Safety Checks → Explicit Sign-off 
→ Orders/Referrals → Care Continuity Setup

POST-VISIT:
Approved Instructions Dispatch → Follow-up Scheduling → Task Tracking 
→ AI Inbox Management → Next Visit Preparation
```

---

## 📋 IMPLEMENTATION PHASES

### Phase 0: Foundation Setup (Week 1-2)
1. Update database schema
2. Set up authentication & authorization
3. Create tenant/clinic isolation
4. Implement audit logging
5. Set up base API structure

### Phase 1: Patient Access (Week 3-4)
1. Patient identity management
2. Appointment booking system
3. Basic smart intake
4. Document upload
5. Web-based patient portal

### Phase 2: Queue & Pre-Visit (Week 5-6)
1. Queue engine
2. Check-in system
3. Priority management
4. Pre-visit brief generation
5. ETA calculation

### Phase 3: Enhanced Doctor Workspace (Week 7-9)
1. Morning brief
2. Enhanced patient context
3. Pre-visit brief display
4. What changed detection
5. Enhanced AI copilot with provenance

### Phase 4: Safety & Prescriptions (Week 10-11)
1. Medication safety checks
2. Enhanced prescription builder
3. Explicit approval workflow
4. Safety alert system

### Phase 5: Care Continuity (Week 12-13)
1. Follow-up engine
2. Order tracking
3. Referral management
4. AI Inbox
5. Patient instructions dispatch

### Phase 6: Communication (Week 14-15)
1. WhatsApp integration
2. SMS notifications
3. Email system
4. Approved dispatch workflow

### Phase 7: Reception & Staff (Week 16-17)
1. Reception workspace
2. Assisted intake
3. Queue management interface
4. Staff task management

### Phase 8: Analytics & Polish (Week 18-20)
1. Analytics dashboard
2. Metrics tracking
3. Performance optimization
4. Testing & refinement

---

## 🎯 SUCCESS CRITERIA

### Patient Experience
- ✅ Book appointment in < 3 minutes
- ✅ Complete intake in < 5 minutes
- ✅ Receive accurate ETA
- ✅ Understand post-visit instructions
- ✅ Never re-enter same information

### Doctor Experience
- ✅ Morning brief loads in < 2 seconds
- ✅ Pre-visit brief available for every patient
- ✅ Time-to-context < 30 seconds
- ✅ Consultation note drafted automatically
- ✅ Safety checks run in real-time
- ✅ Zero post-clinic documentation work

### Safety & Quality
- ✅ 100% prescription safety checks
- ✅ Zero silent autonomous actions
- ✅ Full audit trail
- ✅ Clear AI vs human labeling
- ✅ Source provenance visible

### Operations
- ✅ Queue delay < 20% of scheduled time
- ✅ No-show rate reduced by 30%
- ✅ Follow-up completion > 80%
- ✅ Referral closure > 70%

---

## 🔗 RESEARCH REFERENCES (from v2.0 doc)

1. WHO - Global Patient Safety Action Plan 2021–2030
2. WHO - Medication Without Harm
3. WHO - Integrated people-centred care
4. WHO - Classification of digital interventions in health
5. WHO - Health literacy
6. AHRQ - Diagnostic Error findings
7. AHRQ - Handoff communication tool
8. AMA - Physicians' greatest use for AI
9. ABDM - ABHA/PHR and consent/privacy
10. MeitY - Digital Personal Data Protection Act, 2023
11. CDSCO - Medical Device Software guidance
12. NMC - Registered Medical Practitioner Professional Conduct Regulations 2023

---

## 🚨 CRITICAL PRINCIPLES TO MAINTAIN

1. **AI assists. Clinicians decide.** - No autonomous clinical actions
2. **Explicit approval required** - All clinical actions require sign-off
3. **Source provenance** - Show where AI information came from
4. **Patient safety first** - Multi-layer medication safety checks
5. **Privacy by design** - Consent-based, purpose-limited processing
6. **Audit everything** - Immutable trail for clinical actions
7. **Graceful degradation** - System works even if AI fails
8. **Multilingual & accessible** - Support diverse patient populations
9. **Workflow-native AI** - AI embedded in natural workflows
10. **Longitudinal thinking** - Build patient story over time

---

## 📊 CURRENT STATUS

**Implementation Progress: 15%**

- ✅ Basic doctor workspace UI
- ✅ Demo-level AI features
- ✅ Marketing pages
- ✅ SQLite foundation
- ❌ Patient access system
- ❌ Queue management
- ❌ Pre-visit intelligence
- ❌ Safety gates
- ❌ Care continuity
- ❌ Communication system
- ❌ Authentication/authorization
- ❌ Analytics

**Next Immediate Actions:**
1. Set up proper authentication
2. Implement patient identity system
3. Build appointment booking
4. Create queue engine
5. Develop pre-visit intelligence

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-11  
**Maintainer:** AI UPCHAR Product Team
