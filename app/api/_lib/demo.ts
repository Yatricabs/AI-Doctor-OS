import { NextResponse } from "next/server";
import { all, getProfileSettings, insert, saveProfileSettings, update, query, queryOne, remove } from "./database";

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
  nextPatient: Patient;
  clinicalBrief: string;
};

// ─── NEW TYPES (v2.0) ────────────────────────────────────────────────────────
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

export type AttentionSignal = {
  type: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  source?: string;
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

// ─── PROXY COLLECTIONS (preserved pattern) ───────────────────────────────────
export const patients = new Proxy([] as Patient[], {
  get: (_, prop) => {
    const values = all<Patient>("patients");
    if (prop === "push") return (...items: Patient[]) => { items.forEach((item) => insert("patients", item as unknown as Record<string, unknown>)); return values.length + items.length; };
    if (prop === "length") return values.length;
    if (prop === "filter") return (fn: (item: Patient) => boolean) => values.filter(fn);
    if (prop === "find") return (fn: (item: Patient) => boolean) => values.find(fn);
    if (typeof prop === "string" && /^\d+$/.test(prop)) return values[Number(prop)];
    return (values as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export const reports = new Proxy([] as Report[], {
  get: (_, prop) => {
    const values = all<Report>("reports");
    if (prop === "push") return (...items: Report[]) => { items.forEach((item) => insert("reports", item as unknown as Record<string, unknown>)); return values.length + items.length; };
    if (prop === "length") return values.length;
    if (prop === "filter") return (fn: (item: Report) => boolean) => values.filter(fn);
    if (prop === "find") return (fn: (item: Report) => boolean) => values.find(fn);
    return (values as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export const scribeNotes = new Proxy([] as ScribeNote[], {
  get: (_, prop) => {
    const values = all<ScribeNote>("scribe_notes");
    if (prop === "push") return (...items: ScribeNote[]) => { items.forEach((item) => insert("scribe_notes", item as unknown as Record<string, unknown>)); return values.length + items.length; };
    if (prop === "filter") return (fn: (item: ScribeNote) => boolean) => values.filter(fn);
    if (prop === "find") return (fn: (item: ScribeNote) => boolean) => values.find(fn);
    if (prop === "length") return values.length;
    return (values as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export const insights = new Proxy([] as Insight[], {
  get: (_, prop) => {
    const values = all<Insight>("insights");
    if (prop === "filter") return (fn: (item: Insight) => boolean) => values.filter(fn);
    if (prop === "find") return (fn: (item: Insight) => boolean) => values.find(fn);
    return (values as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export const profileSettings = getProfileSettings();

// ─── PERSIST HELPERS ────────────────────────────────────────────────────────
export function persistInsight(id: string, values: Partial<Insight>) {
  update("insights", id, values as unknown as Record<string, unknown>);
}
export function persistScribeNote(id: string, values: Partial<ScribeNote>) {
  update("scribe_notes", id, values as unknown as Record<string, unknown>);
}
export function persistProfileSettings() { saveProfileSettings(profileSettings); }

// ─── QUERY HELPERS ───────────────────────────────────────────────────────────
export function patientById(id: string) {
  return patients.find((p) => p.id === id);
}

export function getPatientContext(patientId: string) {
  const patient = patientById(patientId);
  if (!patient) return null;
  const meds = query<Medication>("SELECT * FROM medications WHERE patient_id = ? AND status = 'active'", [patientId]);
  const allergies = query<Allergy>("SELECT * FROM allergies WHERE patient_id = ? AND is_active = 1", [patientId]);
  const conditions = query<Condition>("SELECT * FROM conditions WHERE patient_id = ? AND status = 'active'", [patientId]);
  const patientReports = query<Report>("SELECT * FROM reports WHERE patient_id = ? ORDER BY date DESC LIMIT 5", [patientId]);
  const followUps = query<FollowUp>("SELECT * FROM follow_ups WHERE patient_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 5", [patientId]);
  return { patient, medications: meds, allergies, conditions, reports: patientReports, followUps };
}

export function getQueueStatus(clinicId = "clinic-001") {
  const entries = query<QueueEntry>(
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

export function getMorningBrief() {
  const today = new Date().toISOString().slice(0, 10);
  const appointments = query<Appointment>("SELECT * FROM appointments WHERE appointment_date = ? ORDER BY appointment_time ASC", [today]);
  const pendingInbox = query<InboxItem>("SELECT * FROM inbox_items WHERE status = 'open' ORDER BY priority DESC, created_at DESC LIMIT 10", []);
  const overdueFollowUps = query<FollowUp>("SELECT * FROM follow_ups WHERE status = 'pending' AND due_date <= ? ORDER BY priority DESC", [today]);
  const metrics = query<WorkflowMetric>("SELECT * FROM workflow_metrics WHERE metric_date = ?", [today]);
  const pendingNotes = query<ScribeNote>("SELECT * FROM scribe_notes WHERE status = 'draft'", []);
  return { appointments, pendingInbox, overdueFollowUps, metrics, pendingNotes, date: today };
}

export function getInboxItems() {
  return query<InboxItem>(
    "SELECT * FROM inbox_items WHERE status = 'open' ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC",
    []
  );
}

// ─── WORKSPACE SUMMARY (preserved) ───────────────────────────────────────────
export const workspaceSummary: WorkspaceSummary = {
  stats: [
    { label: "Patients today", value: "12", detail: "↗ 18% vs last Tuesday" },
    { label: "Notes completed", value: "08", detail: "↗ 24% this week" },
    { label: "Time saved", value: "2h 14m", detail: "AI-assisted documentation" },
    { label: "Next appointment", value: "10:30 AM", detail: "Rohan Mehta · Follow-up" },
  ],
  nextPatient: patients[0],
  clinicalBrief: "Three follow-ups need review. One report has a new source-linked insight.",
};

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
  } catch { return null; }
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

// Re-export database primitives
export { query, queryOne, insert, update, remove };
