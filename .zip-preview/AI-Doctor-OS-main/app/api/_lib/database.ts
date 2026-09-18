import { createClient } from "@supabase/supabase-js";

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// In-memory data store. See git history / prior notes for why this isn't
// better-sqlite3 (native-binary crashes on serverless hosts). Every write
// mirrors to Supabase (fire-and-forget) when SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY are configured; reads always come from memory.

type Row = Record<string, unknown>;
const tables = new Map<string, Row[]>();
function seedTable(table: string, rows: Row[]) {
  if (!tables.has(table)) tables.set(table, rows);
}

const TODAY = "2026-09-12";

seedTable("patients", [
  { id: "RM-102", name: "Rohan Mehta", initials: "RM", appointment: "Follow-up today · 10:30 AM", status: "Stable", phone: "+91 98200 11021", age: "45", sex: "Male", location: "Andheri, Mumbai" },
  { id: "AK-118", name: "Ananya Kapoor", initials: "AK", appointment: "Annual wellness review · 11:00 AM", status: "Waiting", phone: "+91 98200 22118", age: "32", sex: "Female", location: "Koramangala, Bengaluru" },
  { id: "VN-306", name: "Vikram Nair", initials: "VN", appointment: "Follow-up today · 10:00 AM", status: "In review", phone: "+91 98200 33306", age: "58", sex: "Male", location: "Kochi" },
  { id: "SD-221", name: "Sunita Devi", initials: "SD", appointment: "New patient · 11:15 AM", status: "Waiting", phone: "+91 98200 44221", age: "51", sex: "Female", location: "Lucknow" },
  { id: "PK-140", name: "Prakash Kumar", initials: "PK", appointment: "Follow-up · 11:30 AM", status: "Waiting", phone: "+91 98200 55140", age: "39", sex: "Male", location: "Patna" },
]);

seedTable("reports", [
  { id: "report-cbc-102", patientId: "RM-102", title: "CBC and lipid profile", type: "Lab report", date: "2026-09-10", status: "Ready for review" },
  { id: "report-rx-102", patientId: "RM-102", title: "Active prescriptions", type: "Prescription", date: "2026-09-05", status: "Reviewed" },
  { id: "report-thyroid-118", patientId: "AK-118", title: "Thyroid panel", type: "Lab report", date: "2026-09-09", status: "Ready for review" },
]);

seedTable("scribe_notes", []);

seedTable("insights", [
  { id: "insight-1", title: "Follow-up queue", detail: "Three follow-ups need review before the next clinic block.", priority: "High", status: "open" },
  { id: "insight-2", title: "Report trend", detail: "Rohan Mehta's HbA1c improved while LDL remains above target.", priority: "Medium", status: "open" },
  { id: "insight-3", title: "Documentation quality", detail: "Two draft notes need clinician approval before signing.", priority: "Low", status: "open" },
]);

seedTable("appointments", [
  { id: "appt-1", patientId: "VN-306", patientName: "Vikram Nair", channel: "WhatsApp", date: TODAY, time: "10:00 AM", priority: "Urgent", visitType: "Follow-up", reason: "New ankle swelling alongside ongoing cardiac follow-up", consultationFee: 700, status: "Scheduled", queuePosition: 1, briefReady: true, briefSummary: "New ankle swelling reported alongside ongoing cardiac follow-up. Uploaded lab report shows LDL above target.", missingInfo: "Current BP reading" },
  { id: "appt-2", patientId: "RM-102", patientName: "Rohan Mehta", channel: "Voice call", date: TODAY, time: "10:30 AM", priority: "Follow-up", visitType: "Follow-up", reason: "Diabetes follow-up", consultationFee: 500, status: "Scheduled", queuePosition: 2, briefReady: true, briefSummary: "Routine diabetes follow-up. HbA1c improved since last visit per uploaded prescription photo.", missingInfo: null },
  { id: "appt-3", patientId: "AK-118", patientName: "Ananya Kapoor", channel: "Mobile app", date: TODAY, time: "11:00 AM", priority: "Routine", visitType: "New", reason: "Annual wellness review", consultationFee: 500, status: "Scheduled", queuePosition: 3, briefReady: true, briefSummary: "Annual wellness review. No new symptoms reported in pre-visit intake.", missingInfo: null },
  { id: "appt-4", patientId: "SD-221", patientName: "Sunita Devi", channel: "Walk-in", date: TODAY, time: "11:15 AM", priority: "Routine", visitType: "New", reason: "Walk-in registration — symptom description pending", consultationFee: 500, status: "Scheduled", queuePosition: 4, briefReady: false, briefSummary: "Walk-in registration at front desk. Pre-visit brief not yet available.", missingInfo: "Symptom description" },
  { id: "appt-5", patientId: "PK-140", patientName: "Prakash Kumar", channel: "WhatsApp", date: TODAY, time: "11:30 AM", priority: "Follow-up", visitType: "Follow-up", reason: "Post-surgical follow-up", consultationFee: 400, status: "Scheduled", queuePosition: 5, briefReady: true, briefSummary: "Post-surgical follow-up. Patient uploaded wound-site photo; no signs of infection reported.", missingInfo: null },
]);

seedTable("prescriptions", []);

seedTable("inbox_items", [
  { id: "inbox-1", type: "report_pending", title: "Lab report arrived after visit", detail: "Thyroid panel for Ananya Kapoor was uploaded after her consultation ended. Review and link to her record.", patientId: "AK-118", patientName: "Ananya Kapoor", status: "open", createdAt: "2026-09-10T18:20:00Z" },
  { id: "inbox-2", type: "duplicate_identity", title: "Possible duplicate patient identity", detail: "A new registration for \"Rohan Mehta\" (same phone number as RM-102) was submitted. Confirm whether this is the same patient before merging.", patientId: "RM-102", patientName: "Rohan Mehta", status: "open", createdAt: "2026-09-10T09:05:00Z" },
  { id: "inbox-3", type: "conflict", title: "Conflicting medication record", detail: "WhatsApp intake lists a different current dosage than the last approved prescription for Vikram Nair. Resolve before the visit.", patientId: "VN-306", patientName: "Vikram Nair", status: "open", createdAt: "2026-09-10T07:40:00Z" },
]);

// --- Inventory: medicines (demo seed values per the restructuring spec — editable) ---
function medStatus(stock: number, min: number) { return stock <= 0 ? "Out of stock" : stock <= min ? "Low stock" : "In stock"; }
const medicineSeed: [string, string, number, number, number, number][] = [
  // name, unit, purchasePrice, salePrice, currentStock, minStock
  ["Paracetamol 500 mg", "Tablet", 1, 2, 500, 100],
  ["Azithromycin 500 mg", "Tablet", 7, 12, 120, 30],
  ["Amoxicillin 500 mg", "Capsule", 5, 8, 200, 50],
  ["Pantoprazole 40 mg", "Tablet", 3, 5, 250, 50],
  ["Cetirizine 10 mg", "Tablet", 2, 3, 300, 60],
  ["Metformin 500 mg", "Tablet", 2, 4, 40, 50],
  ["Amlodipine 5 mg", "Tablet", 2, 3, 180, 40],
  ["Atorvastatin 10 mg", "Tablet", 4, 6, 150, 40],
  ["Omeprazole 20 mg", "Capsule", 2, 4, 220, 50],
  ["Ibuprofen 400 mg", "Tablet", 3, 5, 0, 40],
  ["ORS", "Sachet", 14, 20, 100, 30],
  ["Ondansetron 4 mg", "Tablet", 4, 7, 90, 25],
  ["Diclofenac Gel", "Tube", 65, 95, 40, 10],
  ["Cough Syrup", "Bottle", 75, 110, 35, 15],
  ["Multivitamin", "Tablet", 4, 6, 200, 50],
];
seedTable("medicines", medicineSeed.map(([name, unit, purchasePrice, salePrice, currentStock, minStock], i) => ({
  id: `med-${i + 1}`, name, unit, purchasePrice, salePrice, currentStock, minStock, status: medStatus(currentStock, minStock),
})));
seedTable("stock_transactions", []);

// --- Inventory: tests & scans (service catalog — not physical stock) ---
const serviceSeed: [string, string, number][] = [
  ["CBC", "Test", 350], ["Blood Glucose", "Test", 100], ["HbA1c", "Test", 450], ["Lipid Profile", "Test", 650],
  ["Liver Function Test", "Test", 700], ["Kidney Function Test", "Test", 650], ["Thyroid Profile", "Test", 550],
  ["Urine Routine", "Test", 180], ["Vitamin D", "Test", 1200], ["Vitamin B12", "Test", 800],
  ["X-Ray Chest", "Scan", 500], ["X-Ray Knee", "Scan", 500], ["Ultrasound Abdomen", "Scan", 1000],
  ["Ultrasound Pelvis", "Scan", 1000], ["CT Brain", "Scan", 3500], ["CT Abdomen", "Scan", 5000],
  ["MRI Brain", "Scan", 6000], ["MRI Spine", "Scan", 7000], ["ECG", "Procedure", 300], ["2D Echo", "Scan", 2500],
];
seedTable("services", serviceSeed.map(([name, category, price], i) => ({ id: `svc-${i + 1}`, name, category, price, status: "Active" })));

// --- Billing: transactions, linked to patient + appointment ---
seedTable("billing_transactions", [
  { id: "bill-1", patientId: "RM-102", patientName: "Rohan Mehta", appointmentId: "appt-2", type: "Consultation fee", description: "Follow-up consultation", amount: 500, date: TODAY, createdAt: `${TODAY}T05:00:00Z` },
  { id: "bill-2", patientId: "RM-102", patientName: "Rohan Mehta", appointmentId: "appt-2", type: "Medicine", description: "Metformin 500 mg × 30 tablets", amount: 120, date: "2026-09-05", createdAt: "2026-09-05T06:00:00Z" },
  { id: "bill-3", patientId: "AK-118", patientName: "Ananya Kapoor", appointmentId: "appt-3", type: "Consultation fee", description: "New patient consultation", amount: 500, date: TODAY, createdAt: `${TODAY}T05:30:00Z` },
  { id: "bill-4", patientId: "AK-118", patientName: "Ananya Kapoor", appointmentId: "appt-3", type: "Test", description: "Thyroid Profile", amount: 550, date: "2026-09-09", createdAt: "2026-09-09T06:00:00Z" },
  { id: "bill-5", patientId: "VN-306", patientName: "Vikram Nair", appointmentId: "appt-1", type: "Consultation fee", description: "Urgent follow-up consultation", amount: 700, date: TODAY, createdAt: `${TODAY}T04:30:00Z` },
  { id: "bill-6", patientId: "VN-306", patientName: "Vikram Nair", appointmentId: "appt-1", type: "Test", description: "Lipid Profile", amount: 650, date: TODAY, createdAt: `${TODAY}T04:35:00Z` },
]);

type ProfileRow = { fullName: string; specialty: string; clinicBio: string; availableToday: boolean; notifications: { urgentFollowUps: boolean; weeklySummary: boolean; twoStepSignIn: boolean } };
let profile: ProfileRow = {
  fullName: "Dr. Ananya Arya",
  specialty: "General Medicine",
  clinicBio: "Clinician focused on practical, preventive adult care.",
  availableToday: true,
  notifications: { urgentFollowUps: true, weeklySummary: true, twoStepSignIn: true },
};

export function all<T>(table: string): T[] {
  return (tables.get(table) ?? []).map((row) => ({ ...row })) as T[];
}

export function insert(table: string, values: Record<string, unknown>) {
  const rows = tables.get(table) ?? [];
  rows.push({ ...values });
  tables.set(table, rows);
  void syncToSupabase(table, values);
}

export function update(table: string, id: string, values: Record<string, unknown>) {
  const rows = tables.get(table) ?? [];
  const index = rows.findIndex((row) => row.id === id);
  if (index !== -1) rows[index] = { ...rows[index], ...values };
  void syncToSupabase(table, { id, ...values });
}

export function remove(table: string, id: string) {
  const rows = tables.get(table) ?? [];
  tables.set(table, rows.filter((row) => row.id !== id));
}

async function syncToSupabase(table: string, values: Record<string, unknown>) {
  if (!supabase) return;
  const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`), value]));
  const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
  if (error) console.error(`[supabase] ${table} sync failed:`, error.message);
}

export function getProfileSettings(): ProfileRow {
  return { ...profile, notifications: { ...profile.notifications } };
}

export function saveProfileSettings(settings: ProfileRow) {
  profile = { ...settings, notifications: { ...settings.notifications } };
  void syncToSupabase("profile_settings", { id: 1, fullName: settings.fullName, specialty: settings.specialty, clinicBio: settings.clinicBio, availableToday: settings.availableToday, urgentFollowUps: settings.notifications.urgentFollowUps, weeklySummary: settings.notifications.weeklySummary, twoStepSignIn: settings.notifications.twoStepSignIn });
}
