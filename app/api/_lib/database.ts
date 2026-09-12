import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// On serverless platforms (Vercel/AWS Lambda) the working directory is read-only.
// The only writable location is the OS temp dir (/tmp). Detect that and place the
// SQLite file there; locally we keep it in the project's data/ folder.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const dataDir = isServerless ? path.join(os.tmpdir(), "ai-upchar-data") : path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

// During the production build, Next.js spawns several worker processes that all import
// this module and seed the DB in parallel — sharing one file causes SQLITE_BUSY. Give
// each build worker its own file (by PID) so they never contend. At runtime everyone
// shares the single seeded database as before.
const dbFileName = isBuild ? `ai-upchar-build-${process.pid}.sqlite` : "ai-upchar.sqlite";
const database = new Database(path.join(dataDir, dbFileName));
// WAL mode needs a stable filesystem; on serverless /tmp use the default rollback journal.
database.pragma(isServerless ? "journal_mode = MEMORY" : "journal_mode = WAL");
database.pragma("foreign_keys = ON");
// Wait up to 5s for a lock instead of throwing SQLITE_BUSY when routes run in parallel.
database.pragma("busy_timeout = 5000");

// ─── SCHEMA ────────────────────────────────────────────────────────────────
database.exec(`
  -- ── ORIGINAL TABLES (preserved) ──────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    appointment TEXT NOT NULL,
    status TEXT NOT NULL,
    -- extended fields
    date_of_birth TEXT,
    gender TEXT,
    blood_group TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    language TEXT DEFAULT 'en',
    patient_type TEXT DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    extracted_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scribe_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    visit_id TEXT,
    status TEXT NOT NULL,
    subjective TEXT NOT NULL,
    objective TEXT NOT NULL,
    assessment TEXT NOT NULL,
    plan TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    approved_by TEXT,
    disclaimer TEXT
  );

  CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    reviewed_at TEXT,
    reviewed_by TEXT
  );

  CREATE TABLE IF NOT EXISTS profile_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    full_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    clinic_bio TEXT NOT NULL,
    urgent_follow_ups INTEGER NOT NULL,
    weekly_summary INTEGER NOT NULL,
    two_step_sign_in INTEGER NOT NULL
  );

  -- ── AUTH & USERS ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'doctor',
    clinic_id TEXT,
    password_hash TEXT,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    mfa_secret TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'clinic',
    address TEXT,
    phone TEXT,
    email TEXT,
    settings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    patient_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── PATIENT IDENTITY & CONSENT ────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS patient_identities (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    id_type TEXT NOT NULL,
    id_value TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    consent_type TEXT NOT NULL,
    granted INTEGER NOT NULL DEFAULT 0,
    granted_at TEXT,
    expires_at TEXT,
    revoked_at TEXT,
    purpose TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proxy_relationships (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    proxy_name TEXT NOT NULL,
    proxy_phone TEXT,
    relationship TEXT NOT NULL,
    authorized_actions TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── APPOINTMENTS & SCHEDULING ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT,
    clinic_id TEXT,
    department TEXT,
    visit_type TEXT NOT NULL DEFAULT 'new_complaint',
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'requested',
    reason TEXT,
    channel TEXT DEFAULT 'web',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointment_slots (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    clinic_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1,
    appointment_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── QUEUE MANAGEMENT ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS queue_entries (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    appointment_id TEXT,
    clinic_id TEXT,
    doctor_id TEXT,
    department TEXT,
    token_number TEXT,
    priority TEXT NOT NULL DEFAULT 'routine',
    priority_reason TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',
    checked_in_at TEXT,
    called_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    estimated_wait_minutes INTEGER,
    position INTEGER,
    is_walk_in INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS queue_tokens (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    department TEXT,
    date TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    prefix TEXT DEFAULT 'T',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── SMART INTAKE ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS intake_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    appointment_id TEXT,
    visit_type TEXT,
    channel TEXT DEFAULT 'web',
    status TEXT NOT NULL DEFAULT 'in_progress',
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intake_responses (
    id TEXT PRIMARY KEY,
    intake_session_id TEXT NOT NULL,
    question_key TEXT NOT NULL,
    question_text TEXT NOT NULL,
    response_value TEXT,
    response_type TEXT DEFAULT 'text',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── VISITS & CLINICAL ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    appointment_id TEXT,
    doctor_id TEXT,
    clinic_id TEXT,
    visit_type TEXT NOT NULL DEFAULT 'new_complaint',
    chief_complaint TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vitals (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    temperature REAL,
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation REAL,
    weight REAL,
    height REAL,
    bmi REAL,
    recorded_by TEXT,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── PRE-VISIT INTELLIGENCE ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS pre_visit_briefs (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    visit_reason TEXT,
    patient_type TEXT,
    history_summary TEXT,
    medication_summary TEXT,
    what_changed TEXT,
    missing_info TEXT DEFAULT '[]',
    attention_signals TEXT DEFAULT '[]',
    patient_questions TEXT DEFAULT '[]',
    ai_considerations TEXT DEFAULT '[]',
    queue_status TEXT,
    ai_label TEXT DEFAULT 'AI_GENERATED',
    confidence TEXT DEFAULT 'moderate',
    source_ids TEXT DEFAULT '[]',
    review_status TEXT DEFAULT 'generated',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attention_signals (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    signal_type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    source TEXT,
    is_acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── MEDICATIONS & ALLERGIES ───────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    name TEXT NOT NULL,
    generic_name TEXT,
    dose TEXT,
    frequency TEXT,
    route TEXT,
    start_date TEXT,
    end_date TEXT,
    prescribed_by TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS allergies (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    allergen TEXT NOT NULL,
    allergen_type TEXT NOT NULL DEFAULT 'drug',
    reaction TEXT,
    severity TEXT NOT NULL DEFAULT 'moderate',
    onset_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conditions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icd_code TEXT,
    onset_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── PRESCRIPTIONS & SAFETY ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    doctor_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    signed_at TEXT,
    signed_by TEXT,
    dispatched_at TEXT,
    dispatch_channel TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prescription_items (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    generic_name TEXT,
    dose TEXT NOT NULL,
    frequency TEXT NOT NULL,
    route TEXT NOT NULL DEFAULT 'oral',
    duration TEXT,
    quantity TEXT,
    instructions TEXT,
    is_substitutable INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS safety_checks (
    id TEXT PRIMARY KEY,
    prescription_id TEXT,
    patient_id TEXT NOT NULL,
    check_type TEXT NOT NULL,
    medication_a TEXT,
    medication_b TEXT,
    severity TEXT NOT NULL DEFAULT 'moderate',
    message TEXT NOT NULL,
    recommendation TEXT,
    is_overridden INTEGER NOT NULL DEFAULT 0,
    overridden_by TEXT,
    override_reason TEXT,
    overridden_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drug_interactions_db (
    id TEXT PRIMARY KEY,
    drug_a TEXT NOT NULL,
    drug_b TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'moderate',
    description TEXT NOT NULL,
    recommendation TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── FOLLOW-UPS, ORDERS & REFERRALS ───────────────────────────────────────
  CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    doctor_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'routine',
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    completed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS diagnostic_orders (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    doctor_id TEXT,
    order_type TEXT NOT NULL DEFAULT 'lab',
    test_name TEXT NOT NULL,
    instructions TEXT,
    status TEXT NOT NULL DEFAULT 'ordered',
    ordered_at TEXT NOT NULL DEFAULT (datetime('now')),
    result_received_at TEXT,
    result_summary TEXT,
    result_report_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    referring_doctor_id TEXT,
    referred_to_specialty TEXT NOT NULL,
    referred_to_doctor TEXT,
    referred_to_facility TEXT,
    reason TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'routine',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    referral_package TEXT DEFAULT '{}',
    accepted_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── AI INBOX ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS inbox_items (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    visit_id TEXT,
    category TEXT NOT NULL DEFAULT 'task',
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to TEXT,
    due_at TEXT,
    source TEXT,
    action_required TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── COMMUNICATION ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS communication_preferences (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL UNIQUE,
    preferred_channel TEXT NOT NULL DEFAULT 'sms',
    whatsapp_number TEXT,
    sms_number TEXT,
    email TEXT,
    language TEXT DEFAULT 'en',
    do_not_disturb_start TEXT,
    do_not_disturb_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    channel TEXT NOT NULL DEFAULT 'sms',
    direction TEXT NOT NULL DEFAULT 'outbound',
    message_type TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    approved_by TEXT,
    approved_at TEXT,
    sent_at TEXT,
    delivery_status TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── AI SESSIONS & OUTPUTS ─────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    visit_id TEXT,
    user_id TEXT,
    workflow TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_outputs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    patient_id TEXT,
    workflow TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'AI_GENERATED',
    content TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'moderate',
    source_ids TEXT DEFAULT '[]',
    model_version TEXT,
    status TEXT NOT NULL DEFAULT 'generated',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── ANALYTICS ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS workflow_metrics (
    id TEXT PRIMARY KEY,
    clinic_id TEXT,
    metric_date TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── SEED DATA ──────────────────────────────────────────────────────────────
const seed = database.transaction(() => {
  // ── patients ──
  const patientCount = database.prepare("SELECT COUNT(*) as count FROM patients").get() as { count: number };
  if (patientCount.count === 0) {
    const ins = database.prepare(`INSERT INTO patients
      (id, name, initials, appointment, status, date_of_birth, gender, blood_group, phone, patient_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run("RM-102", "Rohan Mehta", "RM", "Follow-up today · 10:30 AM", "Stable", "1994-03-14", "Male", "B+", "+91-9876543210", "returning");
    ins.run("AK-118", "Ananya Kapoor", "AK", "Annual wellness review · 11:00 AM", "Waiting", "1988-07-22", "Female", "O+", "+91-9876543211", "returning");
    ins.run("VN-306", "Vikram Nair", "VN", "Lab results review · 11:30 AM", "In review", "1975-11-05", "Male", "A+", "+91-9876543212", "returning");
    ins.run("PS-401", "Priya Sharma", "PS", "New patient consultation · 2:00 PM", "Waiting", "2001-05-18", "Female", "AB+", "+91-9876543213", "new");
    ins.run("RK-512", "Rahul Kumar", "RK", "Walk-in · Acute complaint", "Waiting", "1990-09-30", "Male", "B-", "+91-9876543214", "walk_in");
  }

  // ── reports ──
  const reportCount = database.prepare("SELECT COUNT(*) as count FROM reports").get() as { count: number };
  if (reportCount.count === 0) {
    const ins = database.prepare("INSERT INTO reports (id, patient_id, title, type, date, status) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("report-cbc-102", "RM-102", "CBC and lipid profile", "Lab report", "2026-09-10", "Ready for review");
    ins.run("report-rx-102", "RM-102", "Active prescriptions", "Prescription", "2026-09-05", "Reviewed");
    ins.run("report-thyroid-118", "AK-118", "Thyroid panel", "Lab report", "2026-09-09", "Ready for review");
    ins.run("report-echo-306", "VN-306", "Echocardiogram", "Lab report", "2026-09-08", "Ready for review");
  }

  // ── insights ──
  const insightCount = database.prepare("SELECT COUNT(*) as count FROM insights").get() as { count: number };
  if (insightCount.count === 0) {
    const ins = database.prepare("INSERT INTO insights (id, title, detail, priority, status, category) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("insight-1", "Follow-up queue", "Three follow-ups need review before the next clinic block.", "High", "open", "workflow");
    ins.run("insight-2", "Report trend", "Rohan Mehta's HbA1c improved while LDL remains above target.", "Medium", "open", "clinical");
    ins.run("insight-3", "Documentation quality", "Two draft notes need clinician approval before signing.", "Low", "open", "workflow");
    ins.run("insight-4", "Safety alert", "Ananya Kapoor has a pending drug-allergy check for new prescription.", "High", "open", "safety");
    ins.run("insight-5", "Queue delay", "Current wait time is 25 minutes above average for this hour.", "Medium", "open", "operations");
  }

  // ── profile settings ──
  database.prepare(`INSERT OR IGNORE INTO profile_settings
    (id, full_name, specialty, clinic_bio, urgent_follow_ups, weekly_summary, two_step_sign_in)
    VALUES (1, ?, ?, ?, ?, ?, ?)`
  ).run("Dr. Ananya Arya", "General Medicine", "Clinician focused on practical, preventive adult care.", 1, 1, 1);

  // ── clinic ──
  const clinicCount = database.prepare("SELECT COUNT(*) as count FROM clinics").get() as { count: number };
  if (clinicCount.count === 0) {
    database.prepare("INSERT INTO clinics (id, name, type, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)").run(
      "clinic-001", "AI UPCHAR Demo Clinic", "clinic",
      "12, Medical Hub, Bandra West, Mumbai - 400050",
      "+91-22-12345678", "clinic@aiupchar.demo"
    );
  }

  // ── users ──
  const userCount = database.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const ins = database.prepare("INSERT INTO users (id, email, name, role, clinic_id, mfa_enabled) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("user-doc-001", "dr.arya@aiupchar.demo", "Dr. Ananya Arya", "doctor", "clinic-001", 1);
    ins.run("user-rec-001", "reception@aiupchar.demo", "Meena Desai", "reception", "clinic-001", 0);
    ins.run("user-adm-001", "admin@aiupchar.demo", "Sanjay Patel", "admin", "clinic-001", 1);
  }

  // ── appointments ──
  const apptCount = database.prepare("SELECT COUNT(*) as count FROM appointments").get() as { count: number };
  if (apptCount.count === 0) {
    const ins = database.prepare(`INSERT INTO appointments
      (id, patient_id, doctor_id, clinic_id, visit_type, appointment_date, appointment_time, duration_minutes, status, reason, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run("appt-001", "RM-102", "user-doc-001", "clinic-001", "follow_up", "2026-09-11", "10:30", 15, "confirmed", "Diabetes follow-up, medication review", "web");
    ins.run("appt-002", "AK-118", "user-doc-001", "clinic-001", "wellness", "2026-09-11", "11:00", 30, "confirmed", "Annual wellness check, thyroid results", "whatsapp");
    ins.run("appt-003", "VN-306", "user-doc-001", "clinic-001", "report_review", "2026-09-11", "11:30", 15, "confirmed", "Echocardiogram review", "web");
    ins.run("appt-004", "PS-401", "user-doc-001", "clinic-001", "new_complaint", "2026-09-11", "14:00", 30, "confirmed", "Persistent headache and fatigue - 1 week", "web");
    ins.run("appt-005", "RK-512", "user-doc-001", "clinic-001", "new_complaint", "2026-09-11", "15:30", 20, "walk_in", "Acute chest pain, shortness of breath", "front_desk");
  }

  // ── queue entries ──
  const queueCount = database.prepare("SELECT COUNT(*) as count FROM queue_entries").get() as { count: number };
  if (queueCount.count === 0) {
    const ins = database.prepare(`INSERT INTO queue_entries
      (id, patient_id, appointment_id, clinic_id, doctor_id, token_number, priority, status, checked_in_at, estimated_wait_minutes, position, is_walk_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run("q-001", "RM-102", "appt-001", "clinic-001", "user-doc-001", "T001", "routine", "in_consultation", datetime(), 0, 1, 0);
    ins.run("q-002", "AK-118", "appt-002", "clinic-001", "user-doc-001", "T002", "routine", "waiting", datetime(), 15, 2, 0);
    ins.run("q-003", "VN-306", "appt-003", "clinic-001", "user-doc-001", "T003", "routine", "waiting", datetime(), 30, 3, 0);
    ins.run("q-004", "PS-401", "appt-004", "clinic-001", "user-doc-001", "T004", "high", "waiting", datetime(), 45, 4, 0);
    ins.run("q-005", "RK-512", "appt-005", "clinic-001", "user-doc-001", "T005", "urgent", "waiting", datetime(), 5, 0, 1);
  }

  // ── medications ──
  const medCount = database.prepare("SELECT COUNT(*) as count FROM medications").get() as { count: number };
  if (medCount.count === 0) {
    const ins = database.prepare("INSERT INTO medications (id, patient_id, name, generic_name, dose, frequency, route, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    ins.run("med-001", "RM-102", "Metformin", "Metformin HCl", "500mg", "Twice daily", "oral", "active");
    ins.run("med-002", "RM-102", "Atorvastatin", "Atorvastatin calcium", "20mg", "Once at night", "oral", "active");
    ins.run("med-003", "AK-118", "Levothyroxine", "Levothyroxine sodium", "50mcg", "Once daily (empty stomach)", "oral", "active");
    ins.run("med-004", "VN-306", "Amlodipine", "Amlodipine besylate", "5mg", "Once daily", "oral", "active");
    ins.run("med-005", "VN-306", "Aspirin", "Acetylsalicylic acid", "75mg", "Once daily", "oral", "active");
  }

  // ── allergies ──
  const allergyCount = database.prepare("SELECT COUNT(*) as count FROM allergies").get() as { count: number };
  if (allergyCount.count === 0) {
    const ins = database.prepare("INSERT INTO allergies (id, patient_id, allergen, allergen_type, reaction, severity) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("allergy-001", "AK-118", "Penicillin", "drug", "Anaphylaxis, hives", "severe");
    ins.run("allergy-002", "AK-118", "Sulfonamides", "drug", "Rash, fever", "moderate");
    ins.run("allergy-003", "RM-102", "Shellfish", "food", "Urticaria", "mild");
    ins.run("allergy-004", "VN-306", "Aspirin", "drug", "GI bleeding, bronchospasm", "severe");
  }

  // ── conditions ──
  const condCount = database.prepare("SELECT COUNT(*) as count FROM conditions").get() as { count: number };
  if (condCount.count === 0) {
    const ins = database.prepare("INSERT INTO conditions (id, patient_id, name, icd_code, onset_date, status) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("cond-001", "RM-102", "Type 2 Diabetes Mellitus", "E11", "2022-03-10", "active");
    ins.run("cond-002", "RM-102", "Hyperlipidaemia", "E78.5", "2022-03-10", "active");
    ins.run("cond-003", "AK-118", "Hypothyroidism", "E03.9", "2020-01-15", "active");
    ins.run("cond-004", "VN-306", "Hypertension", "I10", "2019-06-20", "active");
    ins.run("cond-005", "VN-306", "Ischaemic heart disease", "I25.9", "2021-09-05", "active");
  }

  // ── follow-ups ──
  const fuCount = database.prepare("SELECT COUNT(*) as count FROM follow_ups").get() as { count: number };
  if (fuCount.count === 0) {
    const ins = database.prepare("INSERT INTO follow_ups (id, patient_id, title, description, due_date, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?)");
    ins.run("fu-001", "RM-102", "HbA1c repeat test", "Check glycaemic control after medication adjustment", "2026-09-25", "pending", "high");
    ins.run("fu-002", "RM-102", "Lipid profile follow-up", "LDL still above target — review statin dose", "2026-10-05", "pending", "medium");
    ins.run("fu-003", "AK-118", "Thyroid recheck", "TSH review 6 weeks after Levothyroxine dose change", "2026-10-01", "pending", "medium");
    ins.run("fu-004", "VN-306", "Cardiology follow-up", "Post-echo review with cardiologist", "2026-09-18", "pending", "high");
    ins.run("fu-005", "VN-306", "BP monitoring", "Weekly blood pressure log for 2 weeks", "2026-09-18", "pending", "routine");
  }

  // ── referrals ──
  const refCount = database.prepare("SELECT COUNT(*) as count FROM referrals").get() as { count: number };
  if (refCount.count === 0) {
    const ins = database.prepare("INSERT INTO referrals (id, patient_id, referring_doctor_id, referred_to_specialty, reason, urgency, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    ins.run("ref-001", "VN-306", "user-doc-001", "Cardiology", "Abnormal echocardiogram — reduced EF, requires specialist review", "urgent", "pending");
    ins.run("ref-002", "AK-118", "user-doc-001", "Endocrinology", "Thyroid management optimisation", "routine", "pending");
  }

  // ── diagnostic orders ──
  const ordCount = database.prepare("SELECT COUNT(*) as count FROM diagnostic_orders").get() as { count: number };
  if (ordCount.count === 0) {
    const ins = database.prepare("INSERT INTO diagnostic_orders (id, patient_id, order_type, test_name, status) VALUES (?, ?, ?, ?, ?)");
    ins.run("ord-001", "RM-102", "lab", "HbA1c", "ordered");
    ins.run("ord-002", "RM-102", "lab", "Fasting lipid profile", "ordered");
    ins.run("ord-003", "AK-118", "lab", "TSH + Free T4", "ordered");
    ins.run("ord-004", "VN-306", "imaging", "2D Echocardiogram", "result_received");
  }

  // ── inbox items ──
  const inboxCount = database.prepare("SELECT COUNT(*) as count FROM inbox_items").get() as { count: number };
  if (inboxCount.count === 0) {
    const ins = database.prepare("INSERT INTO inbox_items (id, patient_id, category, title, detail, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    ins.run("inbox-001", "VN-306", "result", "Echocardiogram result ready", "Echocardiogram for Vikram Nair received — reduced ejection fraction noted. Requires urgent clinical review.", "urgent", "open");
    ins.run("inbox-002", "RM-102", "follow_up", "HbA1c follow-up overdue", "Rohan Mehta's HbA1c follow-up was due 3 days ago. Schedule or resolve.", "high", "open");
    ins.run("inbox-003", "AK-118", "message", "Patient question received", "Ananya Kapoor: 'Should I take Levothyroxine if I feel nauseous?'", "medium", "open");
    ins.run("inbox-004", null, "task", "2 draft notes pending approval", "Two SOAP notes from today's clinic are in draft status and require doctor review and approval.", "medium", "open");
    ins.run("inbox-005", "AK-118", "safety", "Penicillin allergy — new referral", "Allergy to Penicillin must be communicated to Endocrinology for referral. Consent and allergy summary not yet attached.", "high", "open");
  }

  // ── drug interactions db ──
  const drugDbCount = database.prepare("SELECT COUNT(*) as count FROM drug_interactions_db").get() as { count: number };
  if (drugDbCount.count === 0) {
    const ins = database.prepare("INSERT INTO drug_interactions_db (id, drug_a, drug_b, severity, description, recommendation) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("di-001", "warfarin", "aspirin", "severe", "Increased risk of bleeding. Aspirin inhibits platelet aggregation and warfarin inhibits clotting factors.", "Avoid combination. If essential, use lowest dose of aspirin with close INR monitoring.");
    ins.run("di-002", "metformin", "alcohol", "moderate", "Increased risk of lactic acidosis with heavy alcohol use.", "Advise patient to limit alcohol consumption.");
    ins.run("di-003", "atorvastatin", "clarithromycin", "severe", "CYP3A4 inhibition increases atorvastatin levels significantly — risk of myopathy and rhabdomyolysis.", "Temporarily withhold atorvastatin during clarithromycin course.");
    ins.run("di-004", "amlodipine", "simvastatin", "moderate", "Amlodipine inhibits CYP3A4, increasing simvastatin levels and risk of myopathy.", "Limit simvastatin dose to 20mg/day when combined with amlodipine.");
    ins.run("di-005", "levothyroxine", "calcium", "moderate", "Calcium reduces levothyroxine absorption.", "Separate doses by at least 4 hours.");
  }

  // ── pre-visit briefs ──
  const briefCount = database.prepare("SELECT COUNT(*) as count FROM pre_visit_briefs").get() as { count: number };
  if (briefCount.count === 0) {
    const ins = database.prepare(`INSERT INTO pre_visit_briefs
      (id, visit_id, patient_id, visit_reason, patient_type, history_summary, medication_summary, what_changed, missing_info, attention_signals, ai_considerations, queue_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run(
      "brief-001", "visit-001", "RM-102",
      "Follow-up for Type 2 Diabetes and hyperlipidaemia management",
      "returning",
      "32-year-old male. Known T2DM (since 2022) and hyperlipidaemia. Last visit: 18 Jun 2026. Previous HbA1c 7.8% (improved from 8.4%). LDL 3.4 mmol/L — still above target.",
      "Metformin 500mg BD, Atorvastatin 20mg ON. Adherence reported as good.",
      "HbA1c improved from 8.4% → 7.8%. LDL has not reached target. Weight stable. BP within normal range at last visit.",
      JSON.stringify(["HbA1c result from today not yet available", "Latest BP reading not recorded"]),
      JSON.stringify([{ type: "lab_due", title: "HbA1c overdue", detail: "HbA1c test was due 3 days ago. Result not in system.", severity: "medium" }]),
      JSON.stringify(["Consider LDL target — may need statin dose increase or addition of ezetimibe", "Renal function check recommended with long-term Metformin use"]),
      "Position 1 · In consultation"
    );
    ins.run(
      "brief-002", "visit-002", "AK-118",
      "Annual wellness review and thyroid panel results",
      "returning",
      "38-year-old female. Hypothyroidism on Levothyroxine since 2020. Allergy: Penicillin (anaphylaxis), Sulfonamides. Last visit: 12 May 2026. TSH was 6.2 mIU/L (above normal), dose was increased.",
      "Levothyroxine 50mcg OD (empty stomach). Recent dose increase 6 weeks ago.",
      "Thyroid panel results now available. TSH at last check: 6.2 mIU/L. New result pending review. Patient reports improved energy levels.",
      JSON.stringify(["New thyroid panel result — pending doctor review"]),
      JSON.stringify([{ type: "allergy", title: "Penicillin allergy on file", detail: "Severe anaphylaxis reaction documented. Ensure no penicillin-class antibiotic in any prescription.", severity: "high" }, { type: "allergy", title: "Sulfonamide allergy on file", detail: "Rash and fever reported. Avoid sulfonamide-containing medications.", severity: "medium" }]),
      JSON.stringify(["Review TSH trend post dose adjustment — aim for TSH 0.5–2.5 mIU/L", "Consider bone density monitoring with long-term levothyroxine"]),
      "Position 2 · Waiting"
    );
  }

  // ── messages ──
  const msgCount = database.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number };
  if (msgCount.count === 0) {
    const ins = database.prepare("INSERT INTO messages (id, patient_id, channel, direction, message_type, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    ins.run("msg-001", "RM-102", "whatsapp", "outbound", "appointment_reminder", "Your appointment with Dr. Ananya Arya is confirmed for today at 10:30 AM. Please bring your recent reports.", "sent");
    ins.run("msg-002", "AK-118", "sms", "outbound", "appointment_reminder", "Your annual wellness review is scheduled for today at 11:00 AM at AI UPCHAR Demo Clinic.", "sent");
    ins.run("msg-003", "AK-118", "whatsapp", "inbound", "patient_question", "Doctor, should I take Levothyroxine if I feel nauseous this morning?", "received");
  }

  // ── workflow metrics ──
  const metricsCount = database.prepare("SELECT COUNT(*) as count FROM workflow_metrics").get() as { count: number };
  if (metricsCount.count === 0) {
    const ins = database.prepare("INSERT INTO workflow_metrics (id, clinic_id, metric_date, metric_type, metric_value) VALUES (?, ?, ?, ?, ?)");
    const today = new Date().toISOString().slice(0, 10);
    ins.run("metric-001", "clinic-001", today, "patients_seen", 8);
    ins.run("metric-002", "clinic-001", today, "avg_wait_minutes", 22);
    ins.run("metric-003", "clinic-001", today, "notes_completed", 6);
    ins.run("metric-004", "clinic-001", today, "safety_alerts_fired", 3);
    ins.run("metric-005", "clinic-001", today, "follow_ups_resolved", 2);
    ins.run("metric-006", "clinic-001", today, "ai_acceptance_rate", 0.78);
    ins.run("metric-007", "clinic-001", today, "prescriptions_signed", 4);
    ins.run("metric-008", "clinic-001", today, "inbox_items_resolved", 3);
  }
});

function datetime() { return new Date().toISOString(); }
// During the Next.js production build, multiple worker processes load this module in
// parallel and each tries to seed the same SQLite file, causing SQLITE_BUSY. Guard the
// seed so a lost race with another worker never crashes module import (which would turn
// every API route into a 500 HTML page at runtime).
try {
  seed();
} catch (err) {
  const code = (err as { code?: string })?.code;
  if (code === "SQLITE_BUSY") {
    console.warn("[db] seed skipped — database busy (another worker is seeding).");
  } else {
    console.error("[db] seed error:", err);
  }
}

// ─── QUERY HELPERS ──────────────────────────────────────────────────────────
export function all<T>(table: string): T[] {
  const rows = database.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  return rows.map(toCamel) as T[];
}

export function query<T>(sql: string, params: unknown[] = []): T[] {
  const rows = database.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map(toCamel) as T[];
}

export function queryOne<T>(sql: string, params: unknown[] = []): T | null {
  const row = database.prepare(sql).get(...params) as Record<string, unknown> | undefined;
  return row ? (toCamel(row) as T) : null;
}

export function insert(table: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  const columns = keys.map(toSnake);
  database.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(...keys.map((k) => values[k]));
  void syncToSupabase(table, values);
}

export function update(table: string, id: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  const sets = keys.map((k) => `${toSnake(k)} = ?`);
  database.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).run(...keys.map((k) => values[k]), id);
  void syncToSupabase(table, { id, ...values });
}

export function remove(table: string, id: string) {
  database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

export function count(table: string, where?: string, params: unknown[] = []): number {
  const sql = where ? `SELECT COUNT(*) as n FROM ${table} WHERE ${where}` : `SELECT COUNT(*) as n FROM ${table}`;
  const row = database.prepare(sql).get(...params) as { n: number };
  return row.n;
}

function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
  );
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

async function syncToSupabase(table: string, values: Record<string, unknown>) {
  if (!supabase) return;
  // Convert camelCase keys → snake_case for Supabase
  const payload = Object.fromEntries(
    Object.entries(values).map(([k, v]) => {
      const snakeKey = toSnake(k);
      // Supabase uses JSONB for array/object columns — stringify if needed
      const val = (Array.isArray(v) || (v !== null && typeof v === "object")) ? JSON.stringify(v) : v;
      return [snakeKey, val];
    })
  );
  const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
  if (error) console.error(`[supabase sync] ${table}:`, error.message);
}

// ─── SUPABASE FULL SYNC (seeds all local SQLite data into Supabase) ──────────
// Called once on startup when Supabase is configured
async function syncAllToSupabase() {
  if (!supabase) return;
  console.log("[supabase] Starting full sync from SQLite → Supabase…");

  const TABLES_TO_SYNC = [
    "clinics", "users", "patients", "appointments", "queue_entries", "queue_tokens",
    "reports", "scribe_notes", "insights", "profile_settings",
    "intake_sessions", "intake_responses", "visits",
    "medications", "allergies", "conditions",
    "prescriptions", "prescription_items", "safety_checks", "drug_interactions_db",
    "follow_ups", "diagnostic_orders", "referrals",
    "inbox_items", "messages", "pre_visit_briefs",
    "workflow_metrics", "ai_outputs", "ai_sessions",
    "communication_preferences", "consents", "audit_logs",
  ];

  let synced = 0;
  let failed = 0;

  for (const table of TABLES_TO_SYNC) {
    try {
      const rows = database.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      if (rows.length === 0) continue;

      // Convert each row's snake_case keys and handle JSONB fields
      const JSONB_COLS = new Set([
        "missing_info", "attention_signals", "patient_questions", "ai_considerations",
        "source_ids", "referral_package", "authorized_actions", "settings",
        "details", "metadata",
      ]);

      const payload = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => {
            // SQLite JSONB fields stored as text strings — parse and re-stringify for Supabase
            if (JSONB_COLS.has(k) && typeof v === "string") {
              try { return [k, JSON.parse(v)]; } catch { return [k, v]; }
            }
            // SQLite booleans stored as 0/1 integers
            const BOOL_COLS = new Set([
              "mfa_enabled", "is_active", "is_walk_in", "is_overridden",
              "is_acknowledged", "is_substitutable", "is_active", "reminder_sent",
              "urgent_follow_ups", "weekly_summary", "two_step_sign_in",
              "verified", "granted",
            ]);
            if (BOOL_COLS.has(k) && (v === 0 || v === 1)) return [k, Boolean(v)];
            return [k, v];
          })
        )
      );

      const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
      if (error) {
        console.error(`[supabase sync] ${table} failed: ${error.message}`);
        failed++;
      } else {
        console.log(`[supabase sync] ✓ ${table} (${rows.length} rows)`);
        synced++;
      }
    } catch (err) {
      console.error(`[supabase sync] ${table} exception:`, err);
      failed++;
    }
  }

  console.log(`[supabase] Full sync complete — ${synced} tables synced, ${failed} failed.`);
}

// Run full sync on startup (fire-and-forget, non-blocking).
// Skip during the Next.js production build ("collecting page data" phase) — running it
// there causes parallel workers to fight over the same SQLite file (SQLITE_BUSY).
if (process.env.NEXT_PHASE !== "phase-production-build") {
  void syncAllToSupabase();
}

// ─── PROFILE HELPERS (preserved API compatibility) ──────────────────────────
export function getProfileSettings() {
  const row = database.prepare("SELECT * FROM profile_settings WHERE id = 1").get() as Record<string, unknown>;
  return {
    fullName: String(row.full_name),
    specialty: String(row.specialty),
    clinicBio: String(row.clinic_bio),
    notifications: {
      urgentFollowUps: Boolean(row.urgent_follow_ups),
      weeklySummary: Boolean(row.weekly_summary),
      twoStepSignIn: Boolean(row.two_step_sign_in),
    },
  };
}

export function saveProfileSettings(settings: {
  fullName: string; specialty: string; clinicBio: string;
  notifications: { urgentFollowUps: boolean; weeklySummary: boolean; twoStepSignIn: boolean };
}) {
  database.prepare(`UPDATE profile_settings SET full_name = ?, specialty = ?, clinic_bio = ?,
    urgent_follow_ups = ?, weekly_summary = ?, two_step_sign_in = ? WHERE id = 1`
  ).run(settings.fullName, settings.specialty, settings.clinicBio,
    Number(settings.notifications.urgentFollowUps),
    Number(settings.notifications.weeklySummary),
    Number(settings.notifications.twoStepSignIn)
  );
  void syncToSupabase("profile_settings", {
    id: 1, fullName: settings.fullName, specialty: settings.specialty,
    clinicBio: settings.clinicBio, ...settings.notifications,
  });
}
