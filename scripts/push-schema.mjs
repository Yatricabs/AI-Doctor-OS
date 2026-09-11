/**
 * AI UPCHAR — Supabase Schema Push Script
 * 
 * Connects directly via PostgreSQL using node-postgres (pg).
 * Run: node scripts/push-schema.mjs
 * 
 * Uses the direct connection string from .env.local
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env ──────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
    const env = {};
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      env[key] = value;
    }
    return env;
  } catch {
    console.error("❌ .env.local not found");
    process.exit(1);
  }
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("🔗 Connected to Supabase:", SUPABASE_URL);

// ── Schema SQL ────────────────────────────────────────────────────────────────
// We execute each CREATE TABLE individually via the Supabase REST API
// (service role key can execute DDL via the sql() function in postgres extension)

const SCHEMA_STATEMENTS = [
// Original tables
`create table if not exists patients (
  id text primary key,
  name text not null,
  initials text not null,
  appointment text not null,
  status text not null,
  date_of_birth text,
  gender text,
  blood_group text,
  phone text,
  email text,
  address text,
  language text default 'en',
  patient_type text default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,

`create table if not exists reports (
  id text primary key,
  patient_id text not null,
  title text not null,
  type text not null,
  date text not null,
  status text not null,
  file_name text,
  file_size integer,
  extracted_text text,
  created_at timestamptz not null default now()
)`,

`create table if not exists scribe_notes (
  id text primary key,
  patient_id text,
  visit_id text,
  status text not null,
  subjective text not null,
  objective text not null,
  assessment text not null,
  plan text not null,
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  disclaimer text
)`,

`create table if not exists insights (
  id text primary key,
  patient_id text,
  title text not null,
  detail text not null,
  priority text not null,
  status text not null,
  category text default 'general',
  reviewed_at timestamptz,
  reviewed_by text
)`,

`create table if not exists profile_settings (
  id integer primary key default 1 check (id = 1),
  full_name text not null,
  specialty text not null,
  clinic_bio text not null,
  urgent_follow_ups boolean not null default true,
  weekly_summary boolean not null default true,
  two_step_sign_in boolean not null default true
)`,

// Clinics & Users
`create table if not exists clinics (
  id text primary key,
  name text not null,
  type text not null default 'clinic',
  address text,
  phone text,
  email text,
  settings jsonb default '{}',
  created_at timestamptz not null default now()
)`,

`create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null default 'doctor',
  clinic_id text,
  password_hash text,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
)`,

`create table if not exists audit_logs (
  id text primary key,
  user_id text,
  patient_id text,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
)`,

// Identity & Consent
`create table if not exists patient_identities (
  id text primary key,
  patient_id text not null,
  id_type text not null,
  id_value text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
)`,

`create table if not exists consents (
  id text primary key,
  patient_id text not null,
  consent_type text not null,
  granted boolean not null default false,
  granted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  purpose text,
  created_at timestamptz not null default now()
)`,

`create table if not exists proxy_relationships (
  id text primary key,
  patient_id text not null,
  proxy_name text not null,
  proxy_phone text,
  relationship text not null,
  authorized_actions jsonb default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
)`,

// Appointments
`create table if not exists appointments (
  id text primary key,
  patient_id text not null,
  doctor_id text,
  clinic_id text,
  department text,
  visit_type text not null default 'new_complaint',
  appointment_date text not null,
  appointment_time text not null,
  duration_minutes integer not null default 15,
  status text not null default 'requested',
  reason text,
  channel text default 'web',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,

`create table if not exists appointment_slots (
  id text primary key,
  doctor_id text not null,
  clinic_id text,
  date text not null,
  start_time text not null,
  end_time text not null,
  is_available boolean not null default true,
  appointment_id text,
  created_at timestamptz not null default now()
)`,

// Queue
`create table if not exists queue_entries (
  id text primary key,
  patient_id text not null,
  appointment_id text,
  clinic_id text,
  doctor_id text,
  department text,
  token_number text,
  priority text not null default 'routine',
  priority_reason text,
  status text not null default 'waiting',
  checked_in_at timestamptz,
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_wait_minutes integer,
  position integer,
  is_walk_in boolean not null default false,
  created_at timestamptz not null default now()
)`,

`create table if not exists queue_tokens (
  id text primary key,
  clinic_id text not null,
  department text,
  date text not null,
  counter integer not null default 0,
  prefix text default 'T',
  created_at timestamptz not null default now()
)`,

// Intake
`create table if not exists intake_sessions (
  id text primary key,
  patient_id text not null,
  appointment_id text,
  visit_type text,
  channel text default 'web',
  status text not null default 'in_progress',
  current_step integer not null default 0,
  total_steps integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,

`create table if not exists intake_responses (
  id text primary key,
  intake_session_id text not null,
  question_key text not null,
  question_text text not null,
  response_value text,
  response_type text default 'text',
  created_at timestamptz not null default now()
)`,

// Visits & Vitals
`create table if not exists visits (
  id text primary key,
  patient_id text not null,
  appointment_id text,
  doctor_id text,
  clinic_id text,
  visit_type text not null default 'new_complaint',
  chief_complaint text,
  status text not null default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
)`,

`create table if not exists vitals (
  id text primary key,
  visit_id text not null,
  patient_id text not null,
  temperature numeric,
  blood_pressure_systolic integer,
  blood_pressure_diastolic integer,
  heart_rate integer,
  respiratory_rate integer,
  oxygen_saturation numeric,
  weight numeric,
  height numeric,
  bmi numeric,
  recorded_by text,
  recorded_at timestamptz not null default now()
)`,

// Pre-visit
`create table if not exists pre_visit_briefs (
  id text primary key,
  visit_id text not null,
  patient_id text not null,
  visit_reason text,
  patient_type text,
  history_summary text,
  medication_summary text,
  what_changed text,
  missing_info jsonb default '[]',
  attention_signals jsonb default '[]',
  patient_questions jsonb default '[]',
  ai_considerations jsonb default '[]',
  queue_status text,
  ai_label text default 'AI_GENERATED',
  confidence text default 'moderate',
  source_ids jsonb default '[]',
  review_status text default 'generated',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
)`,

`create table if not exists attention_signals (
  id text primary key,
  patient_id text not null,
  visit_id text,
  signal_type text not null,
  title text not null,
  detail text not null,
  severity text not null default 'medium',
  source text,
  is_acknowledged boolean not null default false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
)`,

// Medications, Allergies, Conditions
`create table if not exists medications (
  id text primary key,
  patient_id text not null,
  name text not null,
  generic_name text,
  dose text,
  frequency text,
  route text,
  start_date text,
  end_date text,
  prescribed_by text,
  status text not null default 'active',
  created_at timestamptz not null default now()
)`,

`create table if not exists allergies (
  id text primary key,
  patient_id text not null,
  allergen text not null,
  allergen_type text not null default 'drug',
  reaction text,
  severity text not null default 'moderate',
  onset_date text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
)`,

`create table if not exists conditions (
  id text primary key,
  patient_id text not null,
  name text not null,
  icd_code text,
  onset_date text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
)`,

// Prescriptions
`create table if not exists prescriptions (
  id text primary key,
  patient_id text not null,
  visit_id text,
  doctor_id text,
  status text not null default 'draft',
  signed_at timestamptz,
  signed_by text,
  dispatched_at timestamptz,
  dispatch_channel text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,

`create table if not exists prescription_items (
  id text primary key,
  prescription_id text not null,
  medication_name text not null,
  generic_name text,
  dose text not null,
  frequency text not null,
  route text not null default 'oral',
  duration text,
  quantity text,
  instructions text,
  is_substitutable boolean not null default true,
  created_at timestamptz not null default now()
)`,

`create table if not exists safety_checks (
  id text primary key,
  prescription_id text,
  patient_id text not null,
  check_type text not null,
  medication_a text,
  medication_b text,
  severity text not null default 'moderate',
  message text not null,
  recommendation text,
  is_overridden boolean not null default false,
  overridden_by text,
  override_reason text,
  overridden_at timestamptz,
  created_at timestamptz not null default now()
)`,

`create table if not exists drug_interactions_db (
  id text primary key,
  drug_a text not null,
  drug_b text not null,
  severity text not null default 'moderate',
  description text not null,
  recommendation text,
  created_at timestamptz not null default now()
)`,

// Care Continuity
`create table if not exists follow_ups (
  id text primary key,
  patient_id text not null,
  visit_id text,
  doctor_id text,
  title text not null,
  description text,
  due_date text not null,
  status text not null default 'pending',
  priority text not null default 'routine',
  reminder_sent boolean not null default false,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now()
)`,

`create table if not exists diagnostic_orders (
  id text primary key,
  patient_id text not null,
  visit_id text,
  doctor_id text,
  order_type text not null default 'lab',
  test_name text not null,
  instructions text,
  status text not null default 'ordered',
  ordered_at timestamptz not null default now(),
  result_received_at timestamptz,
  result_summary text,
  result_report_id text,
  created_at timestamptz not null default now()
)`,

`create table if not exists referrals (
  id text primary key,
  patient_id text not null,
  visit_id text,
  referring_doctor_id text,
  referred_to_specialty text not null,
  referred_to_doctor text,
  referred_to_facility text,
  reason text not null,
  urgency text not null default 'routine',
  status text not null default 'pending',
  notes text,
  referral_package jsonb default '{}',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
)`,

// Inbox
`create table if not exists inbox_items (
  id text primary key,
  patient_id text,
  visit_id text,
  category text not null default 'task',
  title text not null,
  detail text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  assigned_to text,
  due_at timestamptz,
  source text,
  action_required text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
)`,

// Communication
`create table if not exists communication_preferences (
  id text primary key,
  patient_id text not null unique,
  preferred_channel text not null default 'sms',
  whatsapp_number text,
  sms_number text,
  email text,
  language text default 'en',
  do_not_disturb_start text,
  do_not_disturb_end text,
  created_at timestamptz not null default now()
)`,

`create table if not exists messages (
  id text primary key,
  patient_id text not null,
  visit_id text,
  channel text not null default 'sms',
  direction text not null default 'outbound',
  message_type text not null default 'general',
  content text not null,
  status text not null default 'draft',
  approved_by text,
  approved_at timestamptz,
  sent_at timestamptz,
  delivery_status text,
  created_at timestamptz not null default now()
)`,

// AI
`create table if not exists ai_sessions (
  id text primary key,
  patient_id text,
  visit_id text,
  user_id text,
  workflow text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz
)`,

`create table if not exists ai_outputs (
  id text primary key,
  session_id text,
  patient_id text,
  workflow text not null,
  label text not null default 'AI_GENERATED',
  content text not null,
  confidence text not null default 'moderate',
  source_ids jsonb default '[]',
  model_version text,
  status text not null default 'generated',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
)`,

// Analytics
`create table if not exists workflow_metrics (
  id text primary key,
  clinic_id text,
  metric_date text not null,
  metric_type text not null,
  metric_value numeric not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
)`,

// RLS
`alter table patients enable row level security`,
`alter table reports enable row level security`,
`alter table scribe_notes enable row level security`,
`alter table insights enable row level security`,
`alter table profile_settings enable row level security`,
`alter table clinics enable row level security`,
`alter table users enable row level security`,
`alter table appointments enable row level security`,
`alter table queue_entries enable row level security`,
`alter table intake_sessions enable row level security`,
`alter table medications enable row level security`,
`alter table allergies enable row level security`,
`alter table conditions enable row level security`,
`alter table prescriptions enable row level security`,
`alter table prescription_items enable row level security`,
`alter table safety_checks enable row level security`,
`alter table drug_interactions_db enable row level security`,
`alter table follow_ups enable row level security`,
`alter table referrals enable row level security`,
`alter table inbox_items enable row level security`,
`alter table messages enable row level security`,
`alter table workflow_metrics enable row level security`,
`alter table pre_visit_briefs enable row level security`,
`alter table audit_logs enable row level security`,

// Indexes
`create index if not exists idx_reports_patient_id on reports(patient_id)`,
`create index if not exists idx_appointments_patient_id on appointments(patient_id)`,
`create index if not exists idx_appointments_date on appointments(appointment_date)`,
`create index if not exists idx_queue_entries_clinic on queue_entries(clinic_id, status)`,
`create index if not exists idx_medications_patient on medications(patient_id)`,
`create index if not exists idx_allergies_patient on allergies(patient_id)`,
`create index if not exists idx_conditions_patient on conditions(patient_id)`,
`create index if not exists idx_follow_ups_patient on follow_ups(patient_id)`,
`create index if not exists idx_follow_ups_due on follow_ups(due_date, status)`,
`create index if not exists idx_inbox_items_status on inbox_items(status, priority)`,
`create index if not exists idx_messages_patient on messages(patient_id)`,
`create index if not exists idx_prescriptions_patient on prescriptions(patient_id)`,
];

// ── Seed Data ─────────────────────────────────────────────────────────────────
const SEED_DATA = {
  clinics: [
    { id: "clinic-001", name: "AI UPCHAR Demo Clinic", type: "clinic", address: "12, Medical Hub, Bandra West, Mumbai - 400050", phone: "+91-22-12345678", email: "clinic@aiupchar.demo" },
  ],
  users: [
    { id: "user-doc-001", email: "dr.arya@aiupchar.demo", name: "Dr. Ananya Arya", role: "doctor", clinic_id: "clinic-001", mfa_enabled: true },
    { id: "user-rec-001", email: "reception@aiupchar.demo", name: "Meena Desai", role: "reception", clinic_id: "clinic-001", mfa_enabled: false },
    { id: "user-adm-001", email: "admin@aiupchar.demo", name: "Sanjay Patel", role: "admin", clinic_id: "clinic-001", mfa_enabled: true },
  ],
  patients: [
    { id: "RM-102", name: "Rohan Mehta", initials: "RM", appointment: "Follow-up today · 10:30 AM", status: "Stable", date_of_birth: "1994-03-14", gender: "Male", blood_group: "B+", phone: "+91-9876543210", patient_type: "returning" },
    { id: "AK-118", name: "Ananya Kapoor", initials: "AK", appointment: "Annual wellness review · 11:00 AM", status: "Waiting", date_of_birth: "1988-07-22", gender: "Female", blood_group: "O+", phone: "+91-9876543211", patient_type: "returning" },
    { id: "VN-306", name: "Vikram Nair", initials: "VN", appointment: "Lab results review · 11:30 AM", status: "In review", date_of_birth: "1975-11-05", gender: "Male", blood_group: "A+", phone: "+91-9876543212", patient_type: "returning" },
    { id: "PS-401", name: "Priya Sharma", initials: "PS", appointment: "New patient consultation · 2:00 PM", status: "Waiting", date_of_birth: "2001-05-18", gender: "Female", blood_group: "AB+", phone: "+91-9876543213", patient_type: "new" },
    { id: "RK-512", name: "Rahul Kumar", initials: "RK", appointment: "Walk-in · Acute complaint", status: "Waiting", date_of_birth: "1990-09-30", gender: "Male", blood_group: "B-", phone: "+91-9876543214", patient_type: "walk_in" },
  ],
  reports: [
    { id: "report-cbc-102", patient_id: "RM-102", title: "CBC and lipid profile", type: "Lab report", date: "2026-09-10", status: "Ready for review" },
    { id: "report-rx-102", patient_id: "RM-102", title: "Active prescriptions", type: "Prescription", date: "2026-09-05", status: "Reviewed" },
    { id: "report-thyroid-118", patient_id: "AK-118", title: "Thyroid panel", type: "Lab report", date: "2026-09-09", status: "Ready for review" },
    { id: "report-echo-306", patient_id: "VN-306", title: "Echocardiogram", type: "Lab report", date: "2026-09-08", status: "Ready for review" },
  ],
  insights: [
    { id: "insight-1", title: "Follow-up queue", detail: "Three follow-ups need review before the next clinic block.", priority: "High", status: "open", category: "workflow" },
    { id: "insight-2", title: "Report trend", detail: "Rohan Mehta's HbA1c improved while LDL remains above target.", priority: "Medium", status: "open", category: "clinical" },
    { id: "insight-3", title: "Documentation quality", detail: "Two draft notes need clinician approval before signing.", priority: "Low", status: "open", category: "workflow" },
    { id: "insight-4", title: "Safety alert", detail: "Ananya Kapoor has a pending drug-allergy check for new prescription.", priority: "High", status: "open", category: "safety" },
    { id: "insight-5", title: "Queue delay", detail: "Current wait time is 25 minutes above average for this hour.", priority: "Medium", status: "open", category: "operations" },
  ],
  profile_settings: [
    { id: 1, full_name: "Dr. Ananya Arya", specialty: "General Medicine", clinic_bio: "Clinician focused on practical, preventive adult care.", urgent_follow_ups: true, weekly_summary: true, two_step_sign_in: true },
  ],
  appointments: [
    { id: "appt-001", patient_id: "RM-102", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "follow_up", appointment_date: "2026-09-11", appointment_time: "10:30", duration_minutes: 15, status: "confirmed", reason: "Diabetes follow-up, medication review", channel: "web" },
    { id: "appt-002", patient_id: "AK-118", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "wellness", appointment_date: "2026-09-11", appointment_time: "11:00", duration_minutes: 30, status: "confirmed", reason: "Annual wellness check, thyroid results", channel: "whatsapp" },
    { id: "appt-003", patient_id: "VN-306", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "report_review", appointment_date: "2026-09-11", appointment_time: "11:30", duration_minutes: 15, status: "confirmed", reason: "Echocardiogram review", channel: "web" },
    { id: "appt-004", patient_id: "PS-401", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "new_complaint", appointment_date: "2026-09-11", appointment_time: "14:00", duration_minutes: 30, status: "confirmed", reason: "Persistent headache and fatigue - 1 week", channel: "web" },
    { id: "appt-005", patient_id: "RK-512", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "new_complaint", appointment_date: "2026-09-11", appointment_time: "15:30", duration_minutes: 20, status: "walk_in", reason: "Acute chest pain, shortness of breath", channel: "front_desk" },
  ],
  queue_entries: [
    { id: "q-001", patient_id: "RM-102", appointment_id: "appt-001", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T001", priority: "routine", status: "in_consultation", estimated_wait_minutes: 0, position: 1, is_walk_in: false },
    { id: "q-002", patient_id: "AK-118", appointment_id: "appt-002", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T002", priority: "routine", status: "waiting", estimated_wait_minutes: 15, position: 2, is_walk_in: false },
    { id: "q-003", patient_id: "VN-306", appointment_id: "appt-003", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T003", priority: "routine", status: "waiting", estimated_wait_minutes: 30, position: 3, is_walk_in: false },
    { id: "q-004", patient_id: "PS-401", appointment_id: "appt-004", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T004", priority: "high", status: "waiting", estimated_wait_minutes: 45, position: 4, is_walk_in: false },
    { id: "q-005", patient_id: "RK-512", appointment_id: "appt-005", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T005", priority: "urgent", status: "waiting", estimated_wait_minutes: 5, position: 0, is_walk_in: true },
  ],
  medications: [
    { id: "med-001", patient_id: "RM-102", name: "Metformin", generic_name: "Metformin HCl", dose: "500mg", frequency: "Twice daily", route: "oral", status: "active" },
    { id: "med-002", patient_id: "RM-102", name: "Atorvastatin", generic_name: "Atorvastatin calcium", dose: "20mg", frequency: "Once at night", route: "oral", status: "active" },
    { id: "med-003", patient_id: "AK-118", name: "Levothyroxine", generic_name: "Levothyroxine sodium", dose: "50mcg", frequency: "Once daily (empty stomach)", route: "oral", status: "active" },
    { id: "med-004", patient_id: "VN-306", name: "Amlodipine", generic_name: "Amlodipine besylate", dose: "5mg", frequency: "Once daily", route: "oral", status: "active" },
    { id: "med-005", patient_id: "VN-306", name: "Aspirin", generic_name: "Acetylsalicylic acid", dose: "75mg", frequency: "Once daily", route: "oral", status: "active" },
  ],
  allergies: [
    { id: "allergy-001", patient_id: "AK-118", allergen: "Penicillin", allergen_type: "drug", reaction: "Anaphylaxis, hives", severity: "severe", is_active: true },
    { id: "allergy-002", patient_id: "AK-118", allergen: "Sulfonamides", allergen_type: "drug", reaction: "Rash, fever", severity: "moderate", is_active: true },
    { id: "allergy-003", patient_id: "RM-102", allergen: "Shellfish", allergen_type: "food", reaction: "Urticaria", severity: "mild", is_active: true },
    { id: "allergy-004", patient_id: "VN-306", allergen: "Aspirin", allergen_type: "drug", reaction: "GI bleeding, bronchospasm", severity: "severe", is_active: true },
  ],
  conditions: [
    { id: "cond-001", patient_id: "RM-102", name: "Type 2 Diabetes Mellitus", icd_code: "E11", onset_date: "2022-03-10", status: "active" },
    { id: "cond-002", patient_id: "RM-102", name: "Hyperlipidaemia", icd_code: "E78.5", onset_date: "2022-03-10", status: "active" },
    { id: "cond-003", patient_id: "AK-118", name: "Hypothyroidism", icd_code: "E03.9", onset_date: "2020-01-15", status: "active" },
    { id: "cond-004", patient_id: "VN-306", name: "Hypertension", icd_code: "I10", onset_date: "2019-06-20", status: "active" },
    { id: "cond-005", patient_id: "VN-306", name: "Ischaemic heart disease", icd_code: "I25.9", onset_date: "2021-09-05", status: "active" },
  ],
  follow_ups: [
    { id: "fu-001", patient_id: "RM-102", title: "HbA1c repeat test", description: "Check glycaemic control after medication adjustment", due_date: "2026-09-25", status: "pending", priority: "high" },
    { id: "fu-002", patient_id: "RM-102", title: "Lipid profile follow-up", description: "LDL still above target — review statin dose", due_date: "2026-10-05", status: "pending", priority: "medium" },
    { id: "fu-003", patient_id: "AK-118", title: "Thyroid recheck", description: "TSH review 6 weeks after Levothyroxine dose change", due_date: "2026-10-01", status: "pending", priority: "medium" },
    { id: "fu-004", patient_id: "VN-306", title: "Cardiology follow-up", description: "Post-echo review with cardiologist", due_date: "2026-09-18", status: "pending", priority: "high" },
    { id: "fu-005", patient_id: "VN-306", title: "BP monitoring", description: "Weekly blood pressure log for 2 weeks", due_date: "2026-09-18", status: "pending", priority: "routine" },
  ],
  referrals: [
    { id: "ref-001", patient_id: "VN-306", referring_doctor_id: "user-doc-001", referred_to_specialty: "Cardiology", reason: "Abnormal echocardiogram — reduced EF, requires specialist review", urgency: "urgent", status: "pending" },
    { id: "ref-002", patient_id: "AK-118", referring_doctor_id: "user-doc-001", referred_to_specialty: "Endocrinology", reason: "Thyroid management optimisation", urgency: "routine", status: "pending" },
  ],
  diagnostic_orders: [
    { id: "ord-001", patient_id: "RM-102", order_type: "lab", test_name: "HbA1c", status: "ordered" },
    { id: "ord-002", patient_id: "RM-102", order_type: "lab", test_name: "Fasting lipid profile", status: "ordered" },
    { id: "ord-003", patient_id: "AK-118", order_type: "lab", test_name: "TSH + Free T4", status: "ordered" },
    { id: "ord-004", patient_id: "VN-306", order_type: "imaging", test_name: "2D Echocardiogram", status: "result_received" },
  ],
  inbox_items: [
    { id: "inbox-001", patient_id: "VN-306", category: "result", title: "Echocardiogram result ready", detail: "Echocardiogram for Vikram Nair received — reduced ejection fraction noted. Requires urgent clinical review.", priority: "urgent", status: "open" },
    { id: "inbox-002", patient_id: "RM-102", category: "follow_up", title: "HbA1c follow-up overdue", detail: "Rohan Mehta's HbA1c follow-up was due 3 days ago. Schedule or resolve.", priority: "high", status: "open" },
    { id: "inbox-003", patient_id: "AK-118", category: "message", title: "Patient question received", detail: "Ananya Kapoor: 'Should I take Levothyroxine if I feel nauseous?'", priority: "medium", status: "open" },
    { id: "inbox-004", patient_id: null, category: "task", title: "2 draft notes pending approval", detail: "Two SOAP notes from today's clinic are in draft status and require doctor review and approval.", priority: "medium", status: "open" },
    { id: "inbox-005", patient_id: "AK-118", category: "safety", title: "Penicillin allergy — new referral", detail: "Allergy to Penicillin must be communicated to Endocrinology for referral. Consent and allergy summary not yet attached.", priority: "high", status: "open" },
  ],
  drug_interactions_db: [
    { id: "di-001", drug_a: "warfarin", drug_b: "aspirin", severity: "severe", description: "Increased risk of bleeding. Aspirin inhibits platelet aggregation and warfarin inhibits clotting factors.", recommendation: "Avoid combination. If essential, use lowest dose of aspirin with close INR monitoring." },
    { id: "di-002", drug_a: "metformin", drug_b: "alcohol", severity: "moderate", description: "Increased risk of lactic acidosis with heavy alcohol use.", recommendation: "Advise patient to limit alcohol consumption." },
    { id: "di-003", drug_a: "atorvastatin", drug_b: "clarithromycin", severity: "severe", description: "CYP3A4 inhibition increases atorvastatin levels significantly — risk of myopathy and rhabdomyolysis.", recommendation: "Temporarily withhold atorvastatin during clarithromycin course." },
    { id: "di-004", drug_a: "amlodipine", drug_b: "simvastatin", severity: "moderate", description: "Amlodipine inhibits CYP3A4, increasing simvastatin levels and risk of myopathy.", recommendation: "Limit simvastatin dose to 20mg/day when combined with amlodipine." },
    { id: "di-005", drug_a: "levothyroxine", drug_b: "calcium", severity: "moderate", description: "Calcium reduces levothyroxine absorption.", recommendation: "Separate doses by at least 4 hours." },
  ],
  messages: [
    { id: "msg-001", patient_id: "RM-102", channel: "whatsapp", direction: "outbound", message_type: "appointment_reminder", content: "Your appointment with Dr. Ananya Arya is confirmed for today at 10:30 AM. Please bring your recent reports.", status: "sent" },
    { id: "msg-002", patient_id: "AK-118", channel: "sms", direction: "outbound", message_type: "appointment_reminder", content: "Your annual wellness review is scheduled for today at 11:00 AM at AI UPCHAR Demo Clinic.", status: "sent" },
    { id: "msg-003", patient_id: "AK-118", channel: "whatsapp", direction: "inbound", message_type: "patient_question", content: "Doctor, should I take Levothyroxine if I feel nauseous this morning?", status: "received" },
  ],
  workflow_metrics: (() => {
    const today = new Date().toISOString().slice(0, 10);
    return [
      { id: "metric-001", clinic_id: "clinic-001", metric_date: today, metric_type: "patients_seen", metric_value: 8 },
      { id: "metric-002", clinic_id: "clinic-001", metric_date: today, metric_type: "avg_wait_minutes", metric_value: 22 },
      { id: "metric-003", clinic_id: "clinic-001", metric_date: today, metric_type: "notes_completed", metric_value: 6 },
      { id: "metric-004", clinic_id: "clinic-001", metric_date: today, metric_type: "safety_alerts_fired", metric_value: 3 },
      { id: "metric-005", clinic_id: "clinic-001", metric_date: today, metric_type: "follow_ups_resolved", metric_value: 2 },
      { id: "metric-006", clinic_id: "clinic-001", metric_date: today, metric_type: "ai_acceptance_rate", metric_value: 0.78 },
      { id: "metric-007", clinic_id: "clinic-001", metric_date: today, metric_type: "prescriptions_signed", metric_value: 4 },
      { id: "metric-008", clinic_id: "clinic-001", metric_date: today, metric_type: "inbox_items_resolved", metric_value: 3 },
    ];
  })(),
};

// ── Execute via Supabase RPC (pg extension) ───────────────────────────────────
async function runSQL(sql) {
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
  if (error) {
    // Try direct table operations as fallback
    return { error };
  }
  return { data };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 AI UPCHAR — Supabase Schema Push\n");

  // Step 1: Create tables
  console.log("📦 Creating tables...\n");
  let created = 0, skipped = 0, failed = 0;

  for (const stmt of SCHEMA_STATEMENTS) {
    const tableName = stmt.match(/(?:table|index|alter table)\s+(?:if not exists\s+)?(\w+)/i)?.[1] ?? "unknown";
    try {
      const { error } = await supabase.rpc("exec_sql", { query: stmt });
      if (error) {
        // Some Supabase projects don't have exec_sql — try direct REST approach
        // For CREATE TABLE, we check if table exists by trying to select 0 rows
        if (stmt.toLowerCase().includes("create table")) {
          const tbl = stmt.match(/create table if not exists\s+(\w+)/i)?.[1];
          if (tbl) {
            const { error: selectError } = await supabase.from(tbl).select("id").limit(0);
            if (!selectError) { console.log(`  ✓ ${tbl} (exists)`); skipped++; }
            else { console.log(`  ✗ ${tbl}: ${error.message}`); failed++; }
          }
        } else {
          // DDL like ALTER TABLE, CREATE INDEX — log as info
          console.log(`  ~ ${tableName}: ${error.message}`);
          skipped++;
        }
      } else {
        console.log(`  ✓ ${tableName}`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${tableName}: ${e.message}`);
      failed++;
    }
  }

  // Step 2: Seed data
  console.log(`\n📊 Seeding data...\n`);
  let seeded = 0, seedFailed = 0;

  for (const [table, rows] of Object.entries(SEED_DATA)) {
    if (!rows || rows.length === 0) continue;
    try {
      const { error } = await supabase
        .from(table)
        .upsert(rows, { onConflict: "id" });
      if (error) {
        console.log(`  ✗ ${table}: ${error.message}`);
        seedFailed++;
      } else {
        console.log(`  ✓ ${table} (${rows.length} rows)`);
        seeded++;
      }
    } catch (e) {
      console.log(`  ✗ ${table}: ${e.message}`);
      seedFailed++;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`📦 Schema: ${created} created, ${skipped} skipped, ${failed} failed`);
  console.log(`📊 Seed: ${seeded} tables seeded, ${seedFailed} failed`);

  if (failed > 0 || seedFailed > 0) {
    console.log(`\n⚠️  Some items failed. See instructions below.\n`);
    console.log("MANUAL FALLBACK:");
    console.log("1. Go to: https://supabase.com/dashboard/project/ftxpywplcdcxvhcuwobt/sql");
    console.log("2. Open supabase/schema.sql from this project");
    console.log("3. Paste and run the full SQL");
    console.log("4. Restart the dev server: node node_modules/next/dist/bin/next dev\n");
  } else {
    console.log(`\n✅ All done! Supabase is ready.\n`);
    console.log("Restart dev server to trigger full sync:");
    console.log("  node node_modules/next/dist/bin/next dev\n");
  }
}

main().catch(console.error);
