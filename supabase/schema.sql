-- ============================================================
-- AI UPCHAR v2.0 — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: all statements use CREATE TABLE IF NOT EXISTS
-- ============================================================

-- ── ORIGINAL TABLES (preserved + extended) ─────────────────

create table if not exists patients (
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
);

create table if not exists reports (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  title text not null,
  type text not null,
  date text not null,
  status text not null,
  file_name text,
  file_size integer,
  extracted_text text,
  created_at timestamptz not null default now()
);

create table if not exists scribe_notes (
  id text primary key,
  patient_id text references patients(id) on delete set null,
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
);

create table if not exists insights (
  id text primary key,
  patient_id text references patients(id) on delete set null,
  title text not null,
  detail text not null,
  priority text not null,
  status text not null,
  category text default 'general',
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists profile_settings (
  id integer primary key default 1 check (id = 1),
  full_name text not null,
  specialty text not null,
  clinic_bio text not null,
  urgent_follow_ups boolean not null default true,
  weekly_summary boolean not null default true,
  two_step_sign_in boolean not null default true
);

-- ── AUTH & USERS ────────────────────────────────────────────

create table if not exists clinics (
  id text primary key,
  name text not null,
  type text not null default 'clinic',
  address text,
  phone text,
  email text,
  settings jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null default 'doctor',
  clinic_id text references clinics(id) on delete set null,
  password_hash text,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  user_id text references users(id) on delete set null,
  patient_id text references patients(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

-- ── PATIENT IDENTITY & CONSENT ──────────────────────────────

create table if not exists patient_identities (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  id_type text not null,
  id_value text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists consents (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  consent_type text not null,
  granted boolean not null default false,
  granted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  purpose text,
  created_at timestamptz not null default now()
);

create table if not exists proxy_relationships (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  proxy_name text not null,
  proxy_phone text,
  relationship text not null,
  authorized_actions jsonb default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── APPOINTMENTS & SCHEDULING ───────────────────────────────

create table if not exists appointments (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  doctor_id text references users(id) on delete set null,
  clinic_id text references clinics(id) on delete set null,
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
);

create table if not exists appointment_slots (
  id text primary key,
  doctor_id text not null,
  clinic_id text,
  date text not null,
  start_time text not null,
  end_time text not null,
  is_available boolean not null default true,
  appointment_id text references appointments(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── QUEUE MANAGEMENT ────────────────────────────────────────

create table if not exists queue_entries (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  appointment_id text references appointments(id) on delete set null,
  clinic_id text references clinics(id) on delete set null,
  doctor_id text references users(id) on delete set null,
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
);

create table if not exists queue_tokens (
  id text primary key,
  clinic_id text not null,
  department text,
  date text not null,
  counter integer not null default 0,
  prefix text default 'T',
  created_at timestamptz not null default now()
);

-- ── SMART INTAKE ────────────────────────────────────────────

create table if not exists intake_sessions (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  appointment_id text references appointments(id) on delete set null,
  visit_type text,
  channel text default 'web',
  status text not null default 'in_progress',
  current_step integer not null default 0,
  total_steps integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists intake_responses (
  id text primary key,
  intake_session_id text not null references intake_sessions(id) on delete cascade,
  question_key text not null,
  question_text text not null,
  response_value text,
  response_type text default 'text',
  created_at timestamptz not null default now()
);

-- ── VISITS & CLINICAL ───────────────────────────────────────

create table if not exists visits (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  appointment_id text references appointments(id) on delete set null,
  doctor_id text references users(id) on delete set null,
  clinic_id text references clinics(id) on delete set null,
  visit_type text not null default 'new_complaint',
  chief_complaint text,
  status text not null default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists vitals (
  id text primary key,
  visit_id text not null references visits(id) on delete cascade,
  patient_id text not null references patients(id) on delete cascade,
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
);

-- ── PRE-VISIT INTELLIGENCE ──────────────────────────────────

create table if not exists pre_visit_briefs (
  id text primary key,
  visit_id text not null,
  patient_id text not null references patients(id) on delete cascade,
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
);

create table if not exists attention_signals (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
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
);

-- ── MEDICATIONS & ALLERGIES ─────────────────────────────────

create table if not exists medications (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
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
);

create table if not exists allergies (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  allergen text not null,
  allergen_type text not null default 'drug',
  reaction text,
  severity text not null default 'moderate',
  onset_date text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists conditions (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  name text not null,
  icd_code text,
  onset_date text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

-- ── PRESCRIPTIONS & SAFETY ──────────────────────────────────

create table if not exists prescriptions (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  visit_id text references visits(id) on delete set null,
  doctor_id text references users(id) on delete set null,
  status text not null default 'draft',
  signed_at timestamptz,
  signed_by text,
  dispatched_at timestamptz,
  dispatch_channel text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prescription_items (
  id text primary key,
  prescription_id text not null references prescriptions(id) on delete cascade,
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
);

create table if not exists safety_checks (
  id text primary key,
  prescription_id text references prescriptions(id) on delete cascade,
  patient_id text not null references patients(id) on delete cascade,
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
);

create table if not exists drug_interactions_db (
  id text primary key,
  drug_a text not null,
  drug_b text not null,
  severity text not null default 'moderate',
  description text not null,
  recommendation text,
  created_at timestamptz not null default now()
);

-- ── FOLLOW-UPS, ORDERS & REFERRALS ─────────────────────────

create table if not exists follow_ups (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  visit_id text references visits(id) on delete set null,
  doctor_id text references users(id) on delete set null,
  title text not null,
  description text,
  due_date text not null,
  status text not null default 'pending',
  priority text not null default 'routine',
  reminder_sent boolean not null default false,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now()
);

create table if not exists diagnostic_orders (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  visit_id text references visits(id) on delete set null,
  doctor_id text references users(id) on delete set null,
  order_type text not null default 'lab',
  test_name text not null,
  instructions text,
  status text not null default 'ordered',
  ordered_at timestamptz not null default now(),
  result_received_at timestamptz,
  result_summary text,
  result_report_id text,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  visit_id text references visits(id) on delete set null,
  referring_doctor_id text references users(id) on delete set null,
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
);

-- ── AI INBOX ────────────────────────────────────────────────

create table if not exists inbox_items (
  id text primary key,
  patient_id text references patients(id) on delete cascade,
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
);

-- ── COMMUNICATION ────────────────────────────────────────────

create table if not exists communication_preferences (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade unique,
  preferred_channel text not null default 'sms',
  whatsapp_number text,
  sms_number text,
  email text,
  language text default 'en',
  do_not_disturb_start text,
  do_not_disturb_end text,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
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
);

-- ── AI SESSIONS & OUTPUTS ────────────────────────────────────

create table if not exists ai_sessions (
  id text primary key,
  patient_id text references patients(id) on delete set null,
  visit_id text,
  user_id text references users(id) on delete set null,
  workflow text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists ai_outputs (
  id text primary key,
  session_id text references ai_sessions(id) on delete set null,
  patient_id text references patients(id) on delete set null,
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
);

-- ── ANALYTICS ────────────────────────────────────────────────

create table if not exists workflow_metrics (
  id text primary key,
  clinic_id text references clinics(id) on delete set null,
  metric_date text not null,
  metric_type text not null,
  metric_value numeric not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Service-role key bypasses RLS — used only in server-side API routes.
-- Never expose SUPABASE_SERVICE_ROLE_KEY in NEXT_PUBLIC_* variables.
-- ════════════════════════════════════════════════════════════

alter table patients enable row level security;
alter table reports enable row level security;
alter table scribe_notes enable row level security;
alter table insights enable row level security;
alter table profile_settings enable row level security;
alter table clinics enable row level security;
alter table users enable row level security;
alter table audit_logs enable row level security;
alter table patient_identities enable row level security;
alter table consents enable row level security;
alter table proxy_relationships enable row level security;
alter table appointments enable row level security;
alter table appointment_slots enable row level security;
alter table queue_entries enable row level security;
alter table queue_tokens enable row level security;
alter table intake_sessions enable row level security;
alter table intake_responses enable row level security;
alter table visits enable row level security;
alter table vitals enable row level security;
alter table pre_visit_briefs enable row level security;
alter table attention_signals enable row level security;
alter table medications enable row level security;
alter table allergies enable row level security;
alter table conditions enable row level security;
alter table prescriptions enable row level security;
alter table prescription_items enable row level security;
alter table safety_checks enable row level security;
alter table drug_interactions_db enable row level security;
alter table follow_ups enable row level security;
alter table diagnostic_orders enable row level security;
alter table referrals enable row level security;
alter table inbox_items enable row level security;
alter table communication_preferences enable row level security;
alter table messages enable row level security;
alter table ai_sessions enable row level security;
alter table ai_outputs enable row level security;
alter table workflow_metrics enable row level security;

-- ════════════════════════════════════════════════════════════
-- INDEXES (performance)
-- ════════════════════════════════════════════════════════════

create index if not exists idx_reports_patient_id on reports(patient_id);
create index if not exists idx_scribe_notes_patient_id on scribe_notes(patient_id);
create index if not exists idx_appointments_patient_id on appointments(patient_id);
create index if not exists idx_appointments_date on appointments(appointment_date);
create index if not exists idx_queue_entries_clinic on queue_entries(clinic_id, status);
create index if not exists idx_queue_entries_patient on queue_entries(patient_id);
create index if not exists idx_intake_sessions_patient on intake_sessions(patient_id);
create index if not exists idx_medications_patient on medications(patient_id);
create index if not exists idx_allergies_patient on allergies(patient_id);
create index if not exists idx_conditions_patient on conditions(patient_id);
create index if not exists idx_prescriptions_patient on prescriptions(patient_id);
create index if not exists idx_follow_ups_patient on follow_ups(patient_id);
create index if not exists idx_follow_ups_due_date on follow_ups(due_date, status);
create index if not exists idx_referrals_patient on referrals(patient_id);
create index if not exists idx_inbox_items_status on inbox_items(status, priority);
create index if not exists idx_messages_patient on messages(patient_id);
create index if not exists idx_audit_logs_patient on audit_logs(patient_id);
create index if not exists idx_workflow_metrics_date on workflow_metrics(metric_date, metric_type);
