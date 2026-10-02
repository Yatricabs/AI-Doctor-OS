// ─────────────────────────────────────────────────────────────────────────────
// Shared types, data accessors, and HTTP response helpers for the API layer.
//
// Previously this module exposed synchronous Proxy-backed "collections" (patients,
// reports, ...) because better-sqlite3 was synchronous. Postgres access is async, so
// those are now explicit async accessor functions. Types and response helpers are
// unchanged so route contracts stay identical.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import {
  all,
  getProfileSettings as dbGetProfileSettings,
  insert,
  query,
  queryOne,
  remove,
  saveProfileSettings as dbSaveProfileSettings,
  update,
} from "./database";

// ─── ORIGINAL TYPES (preserved) ─────────────────────────────────────────────
export type Patient = {
  id: string;
  name: string;
  initials: string;
  appointment: string;
  status: "Stable" | "Waiting" | "In review";
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  email?: string;
  address?: string;
  language?: string;
  patientType?: "new" | "returning" | "walk_in";
  createdAt?: string;
  updatedAt?: string;
};

export type Report = {
  id: string;
  patientId: string;
  title: string;
  type: "Lab report" | "Prescription" | "Referral";
  date: string;
  status: "Ready for review" | "Reviewed";
  fileName?: string;
  fileSize?: number;
  extractedText?: string;
  storagePath?: string;
  aiFindings?: string;
  createdAt?: string;
};

export type ScribeNote = {
  id: string;
  patientId: string | null;
  visitId?: string;
  status: "draft" | "saved" | "approved";
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  disclaimer?: string;
};

export type Insight = {
  id: string;
  patientId?: string;
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
  status: "open" | "reviewed";
  category?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type ProfileSettings = {
  fullName: string;
  specialty: string;
  clinicBio: string;
  notifications: {
    urgentFollowUps: boolean;
    weeklySummary: boolean;
    twoStepSignIn: boolean;
  };
};

export type WorkspaceSummary = {
  stats: { label: string; value: string; detail: string }[];
  nextPatient: Patient | null;
  clinicalBrief: string;
};

// ─── v2.0 TYPES ──────────────────────────────────────────────────────────────
export type User = {
  id: string;
  email: string;
  name: string;
  role: "doctor" | "reception" | "staff" | "admin" | "patient";
  clinicId?: string;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
};

export type Clinic = {
  id: string;
  name: string;
  type: "clinic" | "hospital" | "government";
  address?: string;
  phone?: string;
  email?: string;
  settings?: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  doctorId?: string;
  clinicId?: string;
  department?: string;
  visitType: "new_complaint" | "follow_up" | "wellness" | "report_review" | "procedure" | "referral" | "walk_in";
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  status: "requested" | "confirmed" | "checked_in" | "in_queue" | "in_consultation" | "completed" | "cancelled" | "no_show" | "walk_in";
  reason?: string;
  channel?: "web" | "whatsapp" | "mobile" | "voice" | "front_desk";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type QueueEntry = {
  id: string;
  patientId: string;
  appointmentId?: string;
  clinicId?: string;
  doctorId?: string;
  department?: string;
  tokenNumber?: string;
  priority: "urgent" | "high" | "routine" | "follow_up" | "administrative";
  priorityReason?: string;
  status: "waiting" | "called" | "in_consultation" | "completed" | "skipped";
  checkedInAt?: string;
  calledAt?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedWaitMinutes?: number;
  position?: number;
  isWalkIn: boolean;
  createdAt: string;
};

export type Visit = {
  id: string;
  patientId: string;
  appointmentId?: string;
  doctorId?: string;
  clinicId?: string;
  visitType: string;
  chiefComplaint?: string;
  status: "scheduled" | "in_progress" | "completed";
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
};

export type Vitals = {
  id: string;
  visitId: string;
  patientId: string;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  recordedBy?: string;
  recordedAt: string;
};

export type AttentionSignal = {
  type: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  source?: string;
};

export type PreVisitBrief = {
  id: string;
  visitId: string;
  patientId: string;
  visitReason?: string;
  patientType?: string;
  historySummary?: string;
  medicationSummary?: string;
  whatChanged?: string;
  missingInfo: string[];
  attentionSignals: AttentionSignal[];
  patientQuestions: string[];
  aiConsiderations: string[];
  queueStatus?: string;
  aiLabel: string;
  confidence: "high" | "moderate" | "low";
  reviewStatus: "generated" | "reviewed" | "accepted" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
};

export type Medication = {
  id: string;
  patientId: string;
  name: string;
  genericName?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  prescribedBy?: string;
  status: "active" | "stopped" | "on_hold";
  createdAt: string;
};

export type Allergy = {
  id: string;
  patientId: string;
  allergen: string;
  allergenType: "drug" | "food" | "environmental" | "other";
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
  onsetDate?: string;
  isActive: boolean;
  createdAt: string;
};

export type Condition = {
  id: string;
  patientId: string;
  name: string;
  icdCode?: string;
  onsetDate?: string;
  status: "active" | "resolved" | "chronic";
  notes?: string;
  createdAt: string;
};

export type PrescriptionItem = {
  id: string;
  prescriptionId: string;
  medicationName: string;
  genericName?: string;
  dose: string;
  frequency: string;
  route: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  isSubstitutable: boolean;
  createdAt: string;
};

export type SafetyCheck = {
  id: string;
  prescriptionId?: string;
  patientId: string;
  checkType: "allergy" | "interaction" | "duplication" | "dose" | "contraindication";
  medicationA?: string;
  medicationB?: string;
  severity: "mild" | "moderate" | "severe" | "blocked";
  message: string;
  recommendation?: string;
  isOverridden: boolean;
  overriddenBy?: string;
  overrideReason?: string;
  overriddenAt?: string;
  createdAt: string;
};

export type Prescription = {
  id: string;
  patientId: string;
  visitId?: string;
  doctorId?: string;
  status: "draft" | "safety_check" | "needs_review" | "approved" | "signed" | "dispatched" | "revoked";
  signedAt?: string;
  signedBy?: string;
  dispatchedAt?: string;
  dispatchChannel?: string;
  notes?: string;
  items?: PrescriptionItem[];
  safetyChecks?: SafetyCheck[];
  createdAt: string;
  updatedAt: string;
};

export type FollowUp = {
  id: string;
  patientId: string;
  visitId?: string;
  doctorId?: string;
  title: string;
  description?: string;
  dueDate: string;
  status: "pending" | "completed" | "overdue" | "cancelled";
  priority: "urgent" | "high" | "medium" | "routine";
  reminderSent: boolean;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
};

export type DiagnosticOrder = {
  id: string;
  patientId: string;
  visitId?: string;
  doctorId?: string;
  orderType: "lab" | "imaging" | "procedure" | "referral";
  testName: string;
  instructions?: string;
  status: "ordered" | "in_progress" | "result_received" | "reviewed";
  orderedAt: string;
  resultReceivedAt?: string;
  resultSummary?: string;
  resultReportId?: string;
  createdAt: string;
};

export type Referral = {
  id: string;
  patientId: string;
  visitId?: string;
  referringDoctorId?: string;
  referredToSpecialty: string;
  referredToDoctor?: string;
  referredToFacility?: string;
  reason: string;
  urgency: "emergency" | "urgent" | "routine";
  status: "pending" | "sent" | "accepted" | "completed" | "cancelled";
  notes?: string;
  referralPackage?: Record<string, unknown>;
  acceptedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type InboxItem = {
  id: string;
  patientId?: string;
  visitId?: string;
  category: "result" | "follow_up" | "message" | "task" | "safety" | "referral";
  title: string;
  detail: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  assignedTo?: string;
  dueAt?: string;
  source?: string;
  actionRequired?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
};

export type Message = {
  id: string;
  patientId: string;
  visitId?: string;
  channel: "whatsapp" | "sms" | "email" | "push" | "voice";
  direction: "inbound" | "outbound";
  messageType: "appointment_reminder" | "prescription" | "instructions" | "follow_up" | "patient_question" | "general";
  content: string;
  status: "draft" | "pending_approval" | "approved" | "sent" | "delivered" | "failed" | "received";
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  deliveryStatus?: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  userId?: string;
  patientId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
};

export type WorkflowMetric = {
  id: string;
  clinicId?: string;
  metricDate: string;
  metricType: string;
  metricValue: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type InventoryCategory = "medicine" | "test" | "scan";

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  unit?: string;
  price: number;          // sale price (INR)
  purchasePrice: number;  // purchase/cost price (INR) — spec §19
  stockQty: number;
  lowStockThreshold: number; // = minimum stock level (spec §19)
  tracksStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// Stock movement ledger row (spec §22).
export type StockTxnType = "in" | "sale" | "return" | "adjustment";

export type StockTransaction = {
  id: string;
  inventoryItemId: string;
  txnType: StockTxnType;
  quantity: number;      // absolute quantity moved (sign implied by txnType)
  stockAfter: number;    // resulting stock level after this movement
  unitPrice: number;
  reference?: string;    // e.g. bill id / patient id
  note?: string;
  createdAt: string;
};

export type BillItemType = "appointment" | "medicine" | "test" | "scan";

export type BillItem = {
  id: string;
  billId: string;
  inventoryItemId?: string;
  itemType: BillItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: string;
};

export type Bill = {
  id: string;
  patientId: string;
  appointmentId?: string;
  visitId?: string;
  doctorId?: string;
  clinicId?: string;
  status: "paid" | "unpaid" | "partial";
  subtotal: number;
  total: number;
  currency: string;
  notes?: string;
  items?: BillItem[];
  createdAt: string;
  updatedAt: string;
};

// Captured AI generation + (optional) clinician feedback — the raw material for
// fine-tuning our own model later.
export type AiTrainingRecord = {
  id: string;
  workflow: string;              // e.g. "pre_visit_report", "web_research", "report_vision", "intake_phrase"
  patientId?: string;
  model?: string;
  inputContext?: string;         // prompt / context (JSON string)
  aiOutput: string;
  outputType?: string;           // "json" | "text" | "markdown"
  feedback?: "accepted" | "edited" | "rejected" | null;
  correctedOutput?: string;
  rating?: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatTurn = { role: "assistant" | "user"; content: string };

export type AppointmentChat = {
  id: string;
  appointmentId?: string;
  patientId: string;
  briefId?: string;
  transcript: string;   // JSON string of ChatTurn[]
  createdAt: string;
};

// ─── PATIENTS ────────────────────────────────────────────────────────────────
export async function listPatients(): Promise<Patient[]> {
  return query<Patient>("SELECT * FROM patients ORDER BY created_at ASC, id ASC");
}

export async function patientById(id: string): Promise<Patient | null> {
  return queryOne<Patient>("SELECT * FROM patients WHERE id = ?", [id]);
}

export async function addPatient(patient: Patient): Promise<void> {
  await insert("patients", patient as unknown as Record<string, unknown>);
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
export async function listReports(patientId?: string): Promise<Report[]> {
  return patientId
    ? query<Report>("SELECT * FROM reports WHERE patient_id = ? ORDER BY date DESC", [patientId])
    : query<Report>("SELECT * FROM reports ORDER BY date DESC");
}

export async function reportById(id: string): Promise<Report | null> {
  return queryOne<Report>("SELECT * FROM reports WHERE id = ?", [id]);
}

export async function addReport(report: Report): Promise<void> {
  await insert("reports", report as unknown as Record<string, unknown>);
}

// ─── SCRIBE NOTES ────────────────────────────────────────────────────────────
export async function listScribeNotes(patientId?: string): Promise<ScribeNote[]> {
  return patientId
    ? query<ScribeNote>("SELECT * FROM scribe_notes WHERE patient_id = ? ORDER BY updated_at DESC", [patientId])
    : query<ScribeNote>("SELECT * FROM scribe_notes ORDER BY updated_at DESC");
}

export async function scribeNoteById(id: string): Promise<ScribeNote | null> {
  return queryOne<ScribeNote>("SELECT * FROM scribe_notes WHERE id = ?", [id]);
}

export async function addScribeNote(note: ScribeNote): Promise<void> {
  await insert("scribe_notes", note as unknown as Record<string, unknown>);
}

export async function persistScribeNote(id: string, values: Partial<ScribeNote>): Promise<void> {
  await update("scribe_notes", id, values as unknown as Record<string, unknown>);
}

// ─── INSIGHTS ────────────────────────────────────────────────────────────────
export async function listInsights(openOnly = false): Promise<Insight[]> {
  return openOnly
    ? query<Insight>("SELECT * FROM insights WHERE status = 'open' ORDER BY id ASC")
    : query<Insight>("SELECT * FROM insights ORDER BY id ASC");
}

export async function insightById(id: string): Promise<Insight | null> {
  return queryOne<Insight>("SELECT * FROM insights WHERE id = ?", [id]);
}

export async function persistInsight(id: string, values: Partial<Insight>): Promise<void> {
  await update("insights", id, values as unknown as Record<string, unknown>);
}

// ─── PROFILE SETTINGS ────────────────────────────────────────────────────────
export async function getProfileSettings(): Promise<ProfileSettings> {
  return dbGetProfileSettings();
}

export async function saveProfile(settings: ProfileSettings): Promise<void> {
  await dbSaveProfileSettings(settings);
}

// ─── AGGREGATE VIEWS ─────────────────────────────────────────────────────────
export async function getPatientContext(patientId: string) {
  const patient = await patientById(patientId);
  if (!patient) return null;

  const [medications, allergies, conditions, patientReports, followUps] = await Promise.all([
    query<Medication>("SELECT * FROM medications WHERE patient_id = ? AND status = 'active'", [patientId]),
    query<Allergy>("SELECT * FROM allergies WHERE patient_id = ? AND is_active = 1", [patientId]),
    query<Condition>("SELECT * FROM conditions WHERE patient_id = ? AND status = 'active'", [patientId]),
    query<Report>("SELECT * FROM reports WHERE patient_id = ? ORDER BY date DESC LIMIT 5", [patientId]),
    query<FollowUp>(
      "SELECT * FROM follow_ups WHERE patient_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 5",
      [patientId]
    ),
  ]);

  return { patient, medications, allergies, conditions, reports: patientReports, followUps };
}

export async function getQueueStatus(clinicId = "clinic-001") {
  const entries = await query<QueueEntry & { patientName?: string; patientInitials?: string }>(
    `SELECT q.*, p.name as patient_name, p.initials as patient_initials
     FROM queue_entries q JOIN patients p ON q.patient_id = p.id
     WHERE q.clinic_id = ? AND q.status IN ('waiting','called','in_consultation')
     ORDER BY q.position ASC, q.created_at ASC`,
    [clinicId]
  );
  const waiting = entries.filter((e) => e.status === "waiting").length;
  const urgent = entries.filter((e) => e.priority === "urgent").length;
  return { entries, waiting, urgent, total: entries.length };
}

export async function getMorningBrief() {
  const today = new Date().toISOString().slice(0, 10);
  const [appointments, pendingInbox, overdueFollowUps, metrics, pendingNotes] = await Promise.all([
    query<Appointment>("SELECT * FROM appointments WHERE appointment_date = ? ORDER BY appointment_time ASC", [today]),
    query<InboxItem>("SELECT * FROM inbox_items WHERE status = 'open' ORDER BY priority DESC, created_at DESC LIMIT 10"),
    query<FollowUp>("SELECT * FROM follow_ups WHERE status = 'pending' AND due_date <= ? ORDER BY priority DESC", [today]),
    query<WorkflowMetric>("SELECT * FROM workflow_metrics WHERE metric_date = ?", [today]),
    query<ScribeNote>("SELECT * FROM scribe_notes WHERE status = 'draft'"),
  ]);
  return { appointments, pendingInbox, overdueFollowUps, metrics, pendingNotes, date: today };
}

export async function getInboxItems(): Promise<InboxItem[]> {
  return query<InboxItem>(
    `SELECT * FROM inbox_items WHERE status = 'open'
     ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
              created_at DESC`
  );
}

export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const today = new Date().toISOString().slice(0, 10);

  const [patientCount, notesApproved, nextAppt, openInsights, draftNotes] = await Promise.all([
    queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM appointments WHERE appointment_date = ?", [today]),
    queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM scribe_notes WHERE status = 'approved'"),
    queryOne<Appointment & { patientName?: string }>(
      `SELECT a.*, p.name as patient_name FROM appointments a JOIN patients p ON a.patient_id = p.id
       WHERE a.status IN ('confirmed','checked_in','in_queue')
       ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 1`
    ),
    queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM insights WHERE status = 'open'"),
    queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM scribe_notes WHERE status = 'draft'"),
  ]);

  const nextPatient = nextAppt ? await patientById(nextAppt.patientId) : null;

  const stats = [
    {
      label: "Patients today",
      value: String(patientCount?.n ?? 0).padStart(2, "0"),
      detail: "Scheduled for today's clinic",
    },
    {
      label: "Notes completed",
      value: String(notesApproved?.n ?? 0).padStart(2, "0"),
      detail: `${draftNotes?.n ?? 0} still in draft`,
    },
    {
      label: "Open insights",
      value: String(openInsights?.n ?? 0).padStart(2, "0"),
      detail: "Awaiting clinician review",
    },
    {
      label: "Next appointment",
      value: nextAppt?.appointmentTime ?? "—",
      detail: nextPatient ? `${nextPatient.name} · ${String(nextAppt?.visitType ?? "").replace(/_/g, " ")}` : "Nothing scheduled",
    },
  ];

  const clinicalBrief =
    `${openInsights?.n ?? 0} insight(s) need review. ${draftNotes?.n ?? 0} note(s) awaiting approval.`;

  return { stats, nextPatient, clinicalBrief };
}

// ─── RESPONSE HELPERS (preserved) ────────────────────────────────────────────
export function json<T>(data: T, status = 200) {
  return NextResponse.json({ ok: status < 400, data }, { status });
}

export function error(message: string, status = 400, details?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { message, ...(details ? { details } : {}) } }, { status });
}

export async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function requiredString(value: unknown, field: string, maxLength = 200): string | null {
  void field;
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength ? value.trim() : null;
}

export function optionalString(value: unknown, maxLength = 200): string | undefined {
  return typeof value === "string" && value.trim().length <= maxLength ? value.trim() : undefined;
}

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date in YYYY-MM-DD (server local). Used as the minimum bookable day. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validates an appointment date string. Returns an error message if the date is
 * malformed or falls before today; returns null when the date is acceptable
 * (today or any future day). Appointments may not be booked in the past.
 */
export function pastDateError(dateStr: string): string | null {
  const trimmed = String(dateStr).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return "Enter a valid date (YYYY-MM-DD).";
  const picked = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(picked.getTime())) return "Enter a valid date.";
  const today = new Date(`${todayIso()}T00:00:00`);
  if (picked.getTime() < today.getTime()) return "Appointment date cannot be in the past. Please pick today or a later date.";
  return null;
}

/**
 * Wraps a route handler so any thrown error becomes a JSON error response.
 * Without this, an exception makes Next.js return an HTML error page, and the
 * browser fails with "Unexpected token '<'" when parsing it as JSON.
 */
export function safeRoute<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[api] unhandled route error:", err);
      return error(`Server error: ${message}`, 500);
    }
  };
}

// Re-export database primitives so routes can keep importing them from here.
export { all, query, queryOne, insert, update, remove };
