/**
 * AI UPCHAR — Direct Supabase Seed Script
 * 
 * Uses Supabase REST API (upsert) to seed all tables.
 * Tables must already exist — run schema.sql in Supabase SQL Editor first.
 * 
 * Run: node scripts/seed-supabase.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const content = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const today = new Date().toISOString().slice(0, 10);

const SEED = [
  {
    table: "clinics",
    rows: [
      { id: "clinic-001", name: "AI UPCHAR Demo Clinic", type: "clinic", address: "12, Medical Hub, Bandra West, Mumbai - 400050", phone: "+91-22-12345678", email: "clinic@aiupchar.demo" },
    ],
  },
  {
    table: "users",
    rows: [
      { id: "user-doc-001", email: "dr.arya@aiupchar.demo", name: "Dr. Ananya Arya", role: "doctor", clinic_id: "clinic-001", mfa_enabled: true, is_active: true },
      { id: "user-rec-001", email: "reception@aiupchar.demo", name: "Meena Desai", role: "reception", clinic_id: "clinic-001", mfa_enabled: false, is_active: true },
      { id: "user-adm-001", email: "admin@aiupchar.demo", name: "Sanjay Patel", role: "admin", clinic_id: "clinic-001", mfa_enabled: true, is_active: true },
    ],
  },
  {
    table: "patients",
    rows: [
      { id: "RM-102", name: "Rohan Mehta", initials: "RM", appointment: "Follow-up today · 10:30 AM", status: "Stable", date_of_birth: "1994-03-14", gender: "Male", blood_group: "B+", phone: "+91-9876543210", patient_type: "returning" },
      { id: "AK-118", name: "Ananya Kapoor", initials: "AK", appointment: "Annual wellness review · 11:00 AM", status: "Waiting", date_of_birth: "1988-07-22", gender: "Female", blood_group: "O+", phone: "+91-9876543211", patient_type: "returning" },
      { id: "VN-306", name: "Vikram Nair", initials: "VN", appointment: "Lab results review · 11:30 AM", status: "In review", date_of_birth: "1975-11-05", gender: "Male", blood_group: "A+", phone: "+91-9876543212", patient_type: "returning" },
      { id: "PS-401", name: "Priya Sharma", initials: "PS", appointment: "New patient consultation · 2:00 PM", status: "Waiting", date_of_birth: "2001-05-18", gender: "Female", blood_group: "AB+", phone: "+91-9876543213", patient_type: "new" },
      { id: "RK-512", name: "Rahul Kumar", initials: "RK", appointment: "Walk-in · Acute complaint", status: "Waiting", date_of_birth: "1990-09-30", gender: "Male", blood_group: "B-", phone: "+91-9876543214", patient_type: "walk_in" },
    ],
  },
  {
    table: "reports",
    rows: [
      { id: "report-cbc-102", patient_id: "RM-102", title: "CBC and lipid profile", type: "Lab report", date: "2026-09-10", status: "Ready for review" },
      { id: "report-rx-102", patient_id: "RM-102", title: "Active prescriptions", type: "Prescription", date: "2026-09-05", status: "Reviewed" },
      { id: "report-thyroid-118", patient_id: "AK-118", title: "Thyroid panel", type: "Lab report", date: "2026-09-09", status: "Ready for review" },
      { id: "report-echo-306", patient_id: "VN-306", title: "Echocardiogram", type: "Lab report", date: "2026-09-08", status: "Ready for review" },
    ],
  },
  {
    table: "insights",
    rows: [
      { id: "insight-1", title: "Follow-up queue", detail: "Three follow-ups need review before the next clinic block.", priority: "High", status: "open", category: "workflow" },
      { id: "insight-2", title: "Report trend", detail: "Rohan Mehta's HbA1c improved while LDL remains above target.", priority: "Medium", status: "open", category: "clinical" },
      { id: "insight-3", title: "Documentation quality", detail: "Two draft notes need clinician approval before signing.", priority: "Low", status: "open", category: "workflow" },
      { id: "insight-4", title: "Safety alert", detail: "Ananya Kapoor has a pending drug-allergy check for new prescription.", priority: "High", status: "open", category: "safety" },
      { id: "insight-5", title: "Queue delay", detail: "Current wait time is 25 minutes above average for this hour.", priority: "Medium", status: "open", category: "operations" },
    ],
  },
  {
    table: "profile_settings",
    rows: [
      { id: 1, full_name: "Dr. Ananya Arya", specialty: "General Medicine", clinic_bio: "Clinician focused on practical, preventive adult care.", urgent_follow_ups: true, weekly_summary: true, two_step_sign_in: true },
    ],
    conflictCol: "id",
  },
  {
    table: "appointments",
    rows: [
      { id: "appt-001", patient_id: "RM-102", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "follow_up", appointment_date: "2026-09-11", appointment_time: "10:30", duration_minutes: 15, status: "confirmed", reason: "Diabetes follow-up, medication review", channel: "web" },
      { id: "appt-002", patient_id: "AK-118", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "wellness", appointment_date: "2026-09-11", appointment_time: "11:00", duration_minutes: 30, status: "confirmed", reason: "Annual wellness check, thyroid results", channel: "whatsapp" },
      { id: "appt-003", patient_id: "VN-306", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "report_review", appointment_date: "2026-09-11", appointment_time: "11:30", duration_minutes: 15, status: "confirmed", reason: "Echocardiogram review", channel: "web" },
      { id: "appt-004", patient_id: "PS-401", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "new_complaint", appointment_date: "2026-09-11", appointment_time: "14:00", duration_minutes: 30, status: "confirmed", reason: "Persistent headache and fatigue - 1 week", channel: "web" },
      { id: "appt-005", patient_id: "RK-512", doctor_id: "user-doc-001", clinic_id: "clinic-001", visit_type: "new_complaint", appointment_date: "2026-09-11", appointment_time: "15:30", duration_minutes: 20, status: "walk_in", reason: "Acute chest pain, shortness of breath", channel: "front_desk" },
    ],
  },
  {
    table: "queue_entries",
    rows: [
      { id: "q-001", patient_id: "RM-102", appointment_id: "appt-001", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T001", priority: "routine", status: "in_consultation", estimated_wait_minutes: 0, position: 1, is_walk_in: false },
      { id: "q-002", patient_id: "AK-118", appointment_id: "appt-002", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T002", priority: "routine", status: "waiting", estimated_wait_minutes: 15, position: 2, is_walk_in: false },
      { id: "q-003", patient_id: "VN-306", appointment_id: "appt-003", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T003", priority: "routine", status: "waiting", estimated_wait_minutes: 30, position: 3, is_walk_in: false },
      { id: "q-004", patient_id: "PS-401", appointment_id: "appt-004", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T004", priority: "high", status: "waiting", estimated_wait_minutes: 45, position: 4, is_walk_in: false },
      { id: "q-005", patient_id: "RK-512", appointment_id: "appt-005", clinic_id: "clinic-001", doctor_id: "user-doc-001", token_number: "T005", priority: "urgent", status: "waiting", estimated_wait_minutes: 5, position: 0, is_walk_in: true },
    ],
  },
  {
    table: "medications",
    rows: [
      { id: "med-001", patient_id: "RM-102", name: "Metformin", generic_name: "Metformin HCl", dose: "500mg", frequency: "Twice daily", route: "oral", status: "active" },
      { id: "med-002", patient_id: "RM-102", name: "Atorvastatin", generic_name: "Atorvastatin calcium", dose: "20mg", frequency: "Once at night", route: "oral", status: "active" },
      { id: "med-003", patient_id: "AK-118", name: "Levothyroxine", generic_name: "Levothyroxine sodium", dose: "50mcg", frequency: "Once daily (empty stomach)", route: "oral", status: "active" },
      { id: "med-004", patient_id: "VN-306", name: "Amlodipine", generic_name: "Amlodipine besylate", dose: "5mg", frequency: "Once daily", route: "oral", status: "active" },
      { id: "med-005", patient_id: "VN-306", name: "Aspirin", generic_name: "Acetylsalicylic acid", dose: "75mg", frequency: "Once daily", route: "oral", status: "active" },
    ],
  },
  {
    table: "allergies",
    rows: [
      { id: "allergy-001", patient_id: "AK-118", allergen: "Penicillin", allergen_type: "drug", reaction: "Anaphylaxis, hives", severity: "severe", is_active: true },
      { id: "allergy-002", patient_id: "AK-118", allergen: "Sulfonamides", allergen_type: "drug", reaction: "Rash, fever", severity: "moderate", is_active: true },
      { id: "allergy-003", patient_id: "RM-102", allergen: "Shellfish", allergen_type: "food", reaction: "Urticaria", severity: "mild", is_active: true },
      { id: "allergy-004", patient_id: "VN-306", allergen: "Aspirin", allergen_type: "drug", reaction: "GI bleeding, bronchospasm", severity: "severe", is_active: true },
    ],
  },
  {
    table: "conditions",
    rows: [
      { id: "cond-001", patient_id: "RM-102", name: "Type 2 Diabetes Mellitus", icd_code: "E11", onset_date: "2022-03-10", status: "active" },
      { id: "cond-002", patient_id: "RM-102", name: "Hyperlipidaemia", icd_code: "E78.5", onset_date: "2022-03-10", status: "active" },
      { id: "cond-003", patient_id: "AK-118", name: "Hypothyroidism", icd_code: "E03.9", onset_date: "2020-01-15", status: "active" },
      { id: "cond-004", patient_id: "VN-306", name: "Hypertension", icd_code: "I10", onset_date: "2019-06-20", status: "active" },
      { id: "cond-005", patient_id: "VN-306", name: "Ischaemic heart disease", icd_code: "I25.9", onset_date: "2021-09-05", status: "active" },
    ],
  },
  {
    table: "drug_interactions_db",
    rows: [
      { id: "di-001", drug_a: "warfarin", drug_b: "aspirin", severity: "severe", description: "Increased risk of bleeding. Aspirin inhibits platelet aggregation and warfarin inhibits clotting factors.", recommendation: "Avoid combination. If essential, use lowest dose of aspirin with close INR monitoring." },
      { id: "di-002", drug_a: "metformin", drug_b: "alcohol", severity: "moderate", description: "Increased risk of lactic acidosis with heavy alcohol use.", recommendation: "Advise patient to limit alcohol consumption." },
      { id: "di-003", drug_a: "atorvastatin", drug_b: "clarithromycin", severity: "severe", description: "CYP3A4 inhibition increases atorvastatin levels — risk of myopathy and rhabdomyolysis.", recommendation: "Temporarily withhold atorvastatin during clarithromycin course." },
      { id: "di-004", drug_a: "amlodipine", drug_b: "simvastatin", severity: "moderate", description: "Amlodipine inhibits CYP3A4, increasing simvastatin levels and risk of myopathy.", recommendation: "Limit simvastatin dose to 20mg/day when combined with amlodipine." },
      { id: "di-005", drug_a: "levothyroxine", drug_b: "calcium", severity: "moderate", description: "Calcium reduces levothyroxine absorption.", recommendation: "Separate doses by at least 4 hours." },
    ],
  },
  {
    table: "follow_ups",
    rows: [
      { id: "fu-001", patient_id: "RM-102", title: "HbA1c repeat test", description: "Check glycaemic control after medication adjustment", due_date: "2026-09-25", status: "pending", priority: "high" },
      { id: "fu-002", patient_id: "RM-102", title: "Lipid profile follow-up", description: "LDL still above target — review statin dose", due_date: "2026-10-05", status: "pending", priority: "medium" },
      { id: "fu-003", patient_id: "AK-118", title: "Thyroid recheck", description: "TSH review 6 weeks after Levothyroxine dose change", due_date: "2026-10-01", status: "pending", priority: "medium" },
      { id: "fu-004", patient_id: "VN-306", title: "Cardiology follow-up", description: "Post-echo review with cardiologist", due_date: "2026-09-18", status: "pending", priority: "high" },
      { id: "fu-005", patient_id: "VN-306", title: "BP monitoring", description: "Weekly blood pressure log for 2 weeks", due_date: "2026-09-18", status: "pending", priority: "routine" },
    ],
  },
  {
    table: "referrals",
    rows: [
      { id: "ref-001", patient_id: "VN-306", referring_doctor_id: "user-doc-001", referred_to_specialty: "Cardiology", reason: "Abnormal echocardiogram — reduced EF, requires specialist review", urgency: "urgent", status: "pending" },
      { id: "ref-002", patient_id: "AK-118", referring_doctor_id: "user-doc-001", referred_to_specialty: "Endocrinology", reason: "Thyroid management optimisation", urgency: "routine", status: "pending" },
    ],
  },
  {
    table: "diagnostic_orders",
    rows: [
      { id: "ord-001", patient_id: "RM-102", order_type: "lab", test_name: "HbA1c", status: "ordered" },
      { id: "ord-002", patient_id: "RM-102", order_type: "lab", test_name: "Fasting lipid profile", status: "ordered" },
      { id: "ord-003", patient_id: "AK-118", order_type: "lab", test_name: "TSH + Free T4", status: "ordered" },
      { id: "ord-004", patient_id: "VN-306", order_type: "imaging", test_name: "2D Echocardiogram", status: "result_received" },
    ],
  },
  {
    table: "inbox_items",
    rows: [
      { id: "inbox-001", patient_id: "VN-306", category: "result", title: "Echocardiogram result ready", detail: "Echocardiogram for Vikram Nair received — reduced ejection fraction noted. Requires urgent clinical review.", priority: "urgent", status: "open" },
      { id: "inbox-002", patient_id: "RM-102", category: "follow_up", title: "HbA1c follow-up overdue", detail: "Rohan Mehta's HbA1c follow-up was due 3 days ago. Schedule or resolve.", priority: "high", status: "open" },
      { id: "inbox-003", patient_id: "AK-118", category: "message", title: "Patient question received", detail: "Ananya Kapoor: 'Should I take Levothyroxine if I feel nauseous?'", priority: "medium", status: "open" },
      { id: "inbox-004", patient_id: null, category: "task", title: "2 draft notes pending approval", detail: "Two SOAP notes from today are in draft status and require doctor review.", priority: "medium", status: "open" },
      { id: "inbox-005", patient_id: "AK-118", category: "safety", title: "Penicillin allergy — new referral", detail: "Allergy to Penicillin must be communicated to Endocrinology. Consent and allergy summary not yet attached.", priority: "high", status: "open" },
    ],
  },
  {
    table: "messages",
    rows: [
      { id: "msg-001", patient_id: "RM-102", channel: "whatsapp", direction: "outbound", message_type: "appointment_reminder", content: "Your appointment with Dr. Ananya Arya is confirmed for today at 10:30 AM. Please bring your recent reports.", status: "sent" },
      { id: "msg-002", patient_id: "AK-118", channel: "sms", direction: "outbound", message_type: "appointment_reminder", content: "Your annual wellness review is scheduled for today at 11:00 AM at AI UPCHAR Demo Clinic.", status: "sent" },
      { id: "msg-003", patient_id: "AK-118", channel: "whatsapp", direction: "inbound", message_type: "patient_question", content: "Doctor, should I take Levothyroxine if I feel nauseous this morning?", status: "received" },
    ],
  },
  {
    table: "workflow_metrics",
    rows: [
      { id: "metric-001", clinic_id: "clinic-001", metric_date: today, metric_type: "patients_seen", metric_value: 8 },
      { id: "metric-002", clinic_id: "clinic-001", metric_date: today, metric_type: "avg_wait_minutes", metric_value: 22 },
      { id: "metric-003", clinic_id: "clinic-001", metric_date: today, metric_type: "notes_completed", metric_value: 6 },
      { id: "metric-004", clinic_id: "clinic-001", metric_date: today, metric_type: "safety_alerts_fired", metric_value: 3 },
      { id: "metric-005", clinic_id: "clinic-001", metric_date: today, metric_type: "follow_ups_resolved", metric_value: 2 },
      { id: "metric-006", clinic_id: "clinic-001", metric_date: today, metric_type: "ai_acceptance_rate", metric_value: 0.78 },
      { id: "metric-007", clinic_id: "clinic-001", metric_date: today, metric_type: "prescriptions_signed", metric_value: 4 },
      { id: "metric-008", clinic_id: "clinic-001", metric_date: today, metric_type: "inbox_items_resolved", metric_value: 3 },
    ],
  },
];

async function main() {
  console.log("\n🌱 AI UPCHAR — Supabase Seed\n");
  console.log("Connecting to:", env.SUPABASE_URL, "\n");

  // First verify connection by checking if tables exist
  const { error: pingError } = await supabase.from("patients").select("id").limit(1);
  if (pingError) {
    console.error("❌ Cannot reach Supabase tables. Error:", pingError.message);
    console.error("\n👉 Please run the schema SQL first:");
    console.error("   1. Open https://supabase.com/dashboard/project/ftxpywplcdcxvhcuwobt/sql/new");
    console.error("   2. Paste the contents of supabase/schema.sql");
    console.error("   3. Click RUN");
    console.error("   4. Then re-run: node scripts/seed-supabase.mjs\n");
    process.exit(1);
  }

  let ok = 0, fail = 0;

  for (const { table, rows, conflictCol } of SEED) {
    if (!rows?.length) continue;
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: conflictCol ?? "id" });

    if (error) {
      console.log(`  ✗ ${table.padEnd(28)} ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${table.padEnd(28)} ${rows.length} rows`);
      ok++;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  if (fail === 0) {
    console.log(`✅ All ${ok} tables seeded successfully!`);
    console.log("\nSupabase Dashboard → Table Editor to verify data:");
    console.log("https://supabase.com/dashboard/project/ftxpywplcdcxvhcuwobt/editor\n");
  } else {
    console.log(`⚠️  ${ok} seeded, ${fail} failed.`);
    console.log("\nCheck error messages above. Common cause: tables don't exist yet.");
    console.log("Run schema.sql first, then retry.\n");
  }
}

main().catch(console.error);
