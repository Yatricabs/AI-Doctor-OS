// Shared types + helpers for the Operations Dashboard (Dashboard, Appointments,
// Patients, Reports & Documents, Inventory, Billing, Analytics, Settings).
// Mirrors the shapes in app/api/_lib/demo.ts — kept as plain client-side types
// since this is a "use client" surface and shouldn't import server code.

export type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message: string } };

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!envelope.ok || !envelope.data) throw new Error(envelope.error?.message || "Request failed.");
  return envelope.data;
}

export type Patient = { id: string; name: string; initials: string; appointment: string; status: string; phone?: string; age?: string; sex?: string; location?: string };
export type Report = { id: string; patientId: string; title: string; type: "Lab report" | "Prescription" | "Referral"; date: string; status: string };
export type Prescription = { id: string; patientId: string; patientName: string; medication: string; dosage: string; status: string; safetyFlags: string[]; overrideReason?: string; createdAt: string };
export type PreVisitReport = {
  // ── Legacy fields (kept so older callers/UI keep working) ──
  problemSummary: string;
  fullHistory: string;
  provisionalDiagnosis: string;
  furtherTestsNeeded: string;
  recommendedTests: string[];
  recommendedTreatment: string;
  urgency: "OPD" | "Admit for observation" | "Emergency";
  surgeryLikely: string;
  aiGenerated: boolean;
  // ── Rich pre-visit report sections (from the intake AI report) ──
  chiefComplaint?: string;         // what the patient is here for
  duration?: string;               // since when / onset
  likelyCause?: string;            // why it may be happening (assessment narrative)
  possibleConditions?: string[];   // likely diagnoses / possibilities (review-required)
  diagnosisConfidence?: "low" | "moderate" | "high";
  recommendedTestsInitial?: string[];   // first-line tests
  recommendedTestsIfSevere?: string[];  // escalation tests/scans
  recommendedMedicines?: string[];      // medicine considerations (review-required)
  treatmentMeasures?: string[];         // supportive/lifestyle measures
  redFlags?: string[];                  // alarming signs to check — highlighted in UI
  urgencyLevel?: "routine" | "opd" | "urgent" | "admit" | "emergency";
  urgencyReason?: string;
  infoSufficient?: boolean;             // is collected info enough to start treatment?
  infoSufficientNote?: string;
  nextSteps?: string[];                 // clear next-step guidance for the doctor
  narrative?: string;                   // full at-a-glance summary
  visitType?: "new" | "returning";      // new vs follow-up patient
  generatedAt?: string;
  // ── Structured grid fields (for the consultation workspace summary cards) ──
  severityScore?: number;               // 1..10 self-reported severity, if captured
  severityLabel?: string;               // qualitative label, e.g. "As per patient response"
  associatedSymptoms?: string[];        // discrete associated symptoms
  keyConcerns?: string[];               // top concerns to review (falls back to conditions/red flags)
  specialty?: string;                   // e.g. "Gynecology", "Cardiology"
  messageCount?: number;                // how many intake messages the summary was built from
};

// A single prescribed-medicine line in the consultation Prescription table.
export type PrescriptionItem = {
  medicationName: string;
  dose: string;
  frequency: string;
  duration?: string;
  instructions?: string;
};

// A test/investigation ordered during the consultation.
export type OrderedTest = { name: string; category?: string };

// The doctor's plan captured in the consultation workspace (client-side draft shape).
export type ConsultationPlan = {
  notes: string;
  diagnosis: string;
  items: PrescriptionItem[];
  tests: OrderedTest[];
  followUpAfter: string;   // number as string
  followUpUnit: "Days" | "Weeks" | "Months";
  followUpType: "In-clinic Visit" | "Teleconsultation" | "None";
  followUpInstructions: string;
};
export type Appointment = {
  id: string; patientId: string; patientName: string; channel: "WhatsApp" | "Voice call" | "Mobile app" | "Walk-in";
  date: string; time: string; priority: "Urgent" | "Follow-up" | "Routine"; visitType: "New" | "Follow-up";
  reason: string; consultationFee: number; status: "Scheduled" | "Completed" | "Cancelled" | "No-show";
  queuePosition: number; briefReady: boolean; briefSummary: string; missingInfo?: string;
  qaLog?: { question: string; answer: string }[]; preVisitReport?: PreVisitReport;
};
export type Medicine = { id: string; name: string; unit: string; purchasePrice: number; salePrice: number; currentStock: number; minStock: number; status: "In stock" | "Low stock" | "Out of stock" };
export type Service = { id: string; name: string; category: "Test" | "Scan" | "Procedure"; price: number; status: "Active" | "Inactive" };
export type BillingTransaction = { id: string; patientId: string; patientName: string; appointmentId?: string; type: "Consultation fee" | "Medicine" | "Test" | "Scan" | "Procedure"; description: string; amount: number; date: string; createdAt: string };
export type DashboardSummary = {
  date: string;
  appointments: { total: number; new: number; followUp: number; urgent: number; estimatedMinutes: number };
  revenue: { today: number; byType: { type: string; amount: number }[] };
  patients: { total: number };
  inventory: { lowStockCount: number; lowStock: Medicine[] };
  alerts: { openCount: number; items: { id: string; title: string; detail: string; patientName?: string }[] };
};

export function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function todayISO(): string {
  return "2026-09-12"; // fixed demo "today" — matches the seed dataset's dates
}

// Design tokens — same palette as the rest of the demo product for visual consistency.
export const tone = {
  bg: "#f7faf8",
  card: "#ffffff",
  border: "#e1e9e5",
  ink: "#173f3c",
  inkSoft: "#5f7c70",
  muted: "#78908a",
  primary: "#07947f",
  primaryDark: "#153f3c",
  accentGold: "#a17a2d",
  accentGoldBg: "#f6efdd",
  danger: "#b3544a",
  dangerBg: "#fdeceb",
  info: "#6682a5",
  infoBg: "#edf2f8",
  success: "#4f9d78",
  successBg: "#edf7f2",
};

export const priorityTone: Record<Appointment["priority"], string> = { Urgent: "bg-[#fdeceb] text-[#b3544a]", "Follow-up": "bg-[#f6efdd] text-[#a17a2d]", Routine: "bg-[#edf7f2] text-[#4f9d78]" };
export const visitTypeTone: Record<Appointment["visitType"], string> = { New: "bg-[#edf2f8] text-[#6682a5]", "Follow-up": "bg-[#f6efdd] text-[#a17a2d]" };
export const stockTone: Record<Medicine["status"], string> = { "In stock": "bg-[#edf7f2] text-[#4f9d78]", "Low stock": "bg-[#f6efdd] text-[#a17a2d]", "Out of stock": "bg-[#fdeceb] text-[#b3544a]" };
