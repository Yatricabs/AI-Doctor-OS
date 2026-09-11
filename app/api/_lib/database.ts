import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const database = new Database(path.join(dataDir, "ai-upchar.sqlite"));
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    appointment TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scribe_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    status TEXT NOT NULL,
    subjective TEXT NOT NULL,
    objective TEXT NOT NULL,
    assessment TEXT NOT NULL,
    plan TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    disclaimer TEXT
  );
  CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    reviewed_at TEXT
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
`);

const seed = database.transaction(() => {
  const patientCount = database.prepare("SELECT COUNT(*) as count FROM patients").get() as { count: number };
  if (patientCount.count === 0) {
    const insert = database.prepare("INSERT INTO patients (id, name, initials, appointment, status) VALUES (?, ?, ?, ?, ?)");
    insert.run("RM-102", "Rohan Mehta", "RM", "Follow-up today · 10:30 AM", "Stable");
    insert.run("AK-118", "Ananya Kapoor", "AK", "Annual wellness review · 11:00 AM", "Waiting");
    insert.run("VN-306", "Vikram Nair", "VN", "Lab results review · 11:30 AM", "In review");
  }
  const reportCount = database.prepare("SELECT COUNT(*) as count FROM reports").get() as { count: number };
  if (reportCount.count === 0) {
    const insert = database.prepare("INSERT INTO reports (id, patient_id, title, type, date, status) VALUES (?, ?, ?, ?, ?, ?)");
    insert.run("report-cbc-102", "RM-102", "CBC and lipid profile", "Lab report", "2026-09-10", "Ready for review");
    insert.run("report-rx-102", "RM-102", "Active prescriptions", "Prescription", "2026-09-05", "Reviewed");
    insert.run("report-thyroid-118", "AK-118", "Thyroid panel", "Lab report", "2026-09-09", "Ready for review");
  }
  const insightCount = database.prepare("SELECT COUNT(*) as count FROM insights").get() as { count: number };
  if (insightCount.count === 0) {
    const insert = database.prepare("INSERT INTO insights (id, title, detail, priority, status) VALUES (?, ?, ?, ?, ?)");
    insert.run("insight-1", "Follow-up queue", "Three follow-ups need review before the next clinic block.", "High", "open");
    insert.run("insight-2", "Report trend", "Rohan Mehta's HbA1c improved while LDL remains above target.", "Medium", "open");
    insert.run("insight-3", "Documentation quality", "Two draft notes need clinician approval before signing.", "Low", "open");
  }
  database.prepare("INSERT OR IGNORE INTO profile_settings (id, full_name, specialty, clinic_bio, urgent_follow_ups, weekly_summary, two_step_sign_in) VALUES (1, ?, ?, ?, ?, ?, ?)").run("Dr. Ananya Arya", "General Medicine", "Clinician focused on practical, preventive adult care.", 1, 1, 1);
});
seed();

export function all<T>(table: string): T[] {
  const rows = database.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), value]))) as T[];
}

export function insert(table: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  const columns = keys.map((key) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`));
  database.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(...keys.map((key) => values[key]));
  void syncToSupabase(table, values);
}

export function update(table: string, id: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  const columns = keys.map((key) => `${key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)} = ?`);
  database.prepare(`UPDATE ${table} SET ${columns.join(", ")} WHERE id = ?`).run(...keys.map((key) => values[key]), id);
  void syncToSupabase(table, { id, ...values });
}

async function syncToSupabase(table: string, values: Record<string, unknown>) {
  if (!supabase) return;
  const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`), value]));
  const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
  if (error) console.error(`[supabase] ${table} sync failed:`, error.message);
}

export function getProfileSettings() {
  const row = database.prepare("SELECT * FROM profile_settings WHERE id = 1").get() as Record<string, unknown>;
  return { fullName: String(row.full_name), specialty: String(row.specialty), clinicBio: String(row.clinic_bio), notifications: { urgentFollowUps: Boolean(row.urgent_follow_ups), weeklySummary: Boolean(row.weekly_summary), twoStepSignIn: Boolean(row.two_step_sign_in) } };
}

export function saveProfileSettings(settings: { fullName: string; specialty: string; clinicBio: string; notifications: { urgentFollowUps: boolean; weeklySummary: boolean; twoStepSignIn: boolean } }) {
  database.prepare("UPDATE profile_settings SET full_name = ?, specialty = ?, clinic_bio = ?, urgent_follow_ups = ?, weekly_summary = ?, two_step_sign_in = ? WHERE id = 1").run(settings.fullName, settings.specialty, settings.clinicBio, Number(settings.notifications.urgentFollowUps), Number(settings.notifications.weeklySummary), Number(settings.notifications.twoStepSignIn));
  void syncToSupabase("profile_settings", { id: 1, fullName: settings.fullName, specialty: settings.specialty, clinicBio: settings.clinicBio, urgentFollowUps: settings.notifications.urgentFollowUps, weeklySummary: settings.notifications.weeklySummary, twoStepSignIn: settings.notifications.twoStepSignIn });
}
