import { NextResponse } from "next/server";
import { all, getProfileSettings, insert, remove, saveProfileSettings, update } from "./database";
import { RED_FLAG_KEYWORDS, detectRedFlags } from "@/lib/red-flag-keywords";

export { RED_FLAG_KEYWORDS, detectRedFlags };

export type Patient = {
  id: string;
  name: string;
  initials: string;
  appointment: string;
  status: "Stable" | "Waiting" | "In review";
  phone?: string;
  age?: string;
  sex?: string;
  location?: string;
};

export type Report = {
  id: string;
  patientId: string;
  title: string;
  type: "Lab report" | "Prescription" | "Referral";
  date: string;
  status: "Ready for review" | "Reviewed";
};

export type ScribeNote = {
  id: string;
  patientId: string | null;
  status: "draft" | "saved" | "approved";
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  updatedAt: string;
  disclaimer?: string;
};

export type Insight = {
  id: string;
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
  status: "open" | "reviewed";
  reviewedAt?: string;
};

export type PreVisitReport = {
  problemSummary: string;
  fullHistory: string;
  provisionalDiagnosis: string;
  furtherTestsNeeded: string;
  recommendedTests: string[];
  recommendedTreatment: string;
  urgency: "OPD" | "Admit for observation" | "Emergency";
  surgeryLikely: string;
  aiGenerated: boolean;
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  channel: "WhatsApp" | "Voice call" | "Mobile app" | "Walk-in";
  date: string;
  time: string;
  priority: "Urgent" | "Follow-up" | "Routine";
  visitType: "New" | "Follow-up";
  reason: string;
  consultationFee: number;
  status: "Scheduled" | "Completed" | "Cancelled" | "No-show";
  queuePosition: number;
  briefReady: boolean;
  briefSummary: string;
  missingInfo?: string;
  qaLog?: { question: string; answer: string }[];
  preVisitReport?: PreVisitReport;
};

export type Prescription = {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  dosage: string;
  status: "DRAFT" | "SAFETY_CHECK" | "NEEDS_REVIEW" | "APPROVED" | "DISPATCHED";
  safetyFlags: string[];
  overrideReason?: string;
  createdAt: string;
};

export type InboxItem = {
  id: string;
  type: "report_pending" | "duplicate_identity" | "conflict" | "red_flag" | "reschedule";
  title: string;
  detail: string;
  patientId?: string;
  patientName?: string;
  status: "open" | "resolved";
  createdAt: string;
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

export type Medicine = {
  id: string;
  name: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  currentStock: number;
  minStock: number;
  status: "In stock" | "Low stock" | "Out of stock";
};

export type StockTransaction = {
  id: string;
  medicineId: string;
  medicineName: string;
  type: "in" | "out" | "return" | "adjustment";
  quantity: number;
  note?: string;
  createdAt: string;
};

export type Service = {
  id: string;
  name: string;
  category: "Test" | "Scan" | "Procedure";
  price: number;
  status: "Active" | "Inactive";
};

export type BillingTransaction = {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  type: "Consultation fee" | "Medicine" | "Test" | "Scan" | "Procedure";
  description: string;
  amount: number;
  date: string;
  createdAt: string;
};

export type WorkspaceSummary = {
  stats: { label: string; value: string; detail: string }[];
  nextPatient: Patient;
  clinicalBrief: string;
};

export const patients = new Proxy([] as Patient[], { get: (_, property) => { const values = all<Patient>("patients"); if (property === "push") return (...items: Patient[]) => { items.forEach((item) => insert("patients", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Patient) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Patient) => boolean) => values.find(fn); if (typeof property === "string" && /^\d+$/.test(property)) return values[Number(property)]; return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const reports = new Proxy([] as Report[], { get: (_, property) => { const values = all<Report>("reports"); if (property === "push") return (...items: Report[]) => { items.forEach((item) => insert("reports", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Report) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Report) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const scribeNotes = new Proxy([] as ScribeNote[], { get: (_, property) => { const values = all<ScribeNote>("scribe_notes"); if (property === "push") return (...items: ScribeNote[]) => { items.forEach((item) => insert("scribe_notes", item)); return values.length + items.length; }; if (property === "filter") return (fn: (item: ScribeNote) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: ScribeNote) => boolean) => values.find(fn); if (property === "length") return values.length; return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const insights = new Proxy([] as Insight[], { get: (_, property) => { const values = all<Insight>("insights"); if (property === "filter") return (fn: (item: Insight) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Insight) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const appointments = new Proxy([] as Appointment[], { get: (_, property) => { const values = all<Appointment>("appointments").map((item) => ({ ...item, briefReady: Boolean(item.briefReady) })); if (property === "push") return (...items: Appointment[]) => { items.forEach((item) => insert("appointments", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Appointment) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Appointment) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const prescriptions = new Proxy([] as Prescription[], { get: (_, property) => { const values = all<{ id: string; patientId: string; patientName: string; medication: string; dosage: string; status: string; safetyFlags: string; overrideReason?: string; createdAt: string }>("prescriptions").map((item) => ({ ...item, safetyFlags: JSON.parse(item.safetyFlags) as string[] })) as unknown as Prescription[]; if (property === "push") return (...items: Prescription[]) => { items.forEach((item) => insert("prescriptions", { ...item, safetyFlags: JSON.stringify(item.safetyFlags) })); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Prescription) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Prescription) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const inboxItems = new Proxy([] as InboxItem[], { get: (_, property) => { const values = all<InboxItem>("inbox_items"); if (property === "push") return (...items: InboxItem[]) => { items.forEach((item) => insert("inbox_items", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: InboxItem) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: InboxItem) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const medicines = new Proxy([] as Medicine[], { get: (_, property) => { const values = all<Medicine>("medicines"); if (property === "push") return (...items: Medicine[]) => { items.forEach((item) => insert("medicines", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Medicine) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Medicine) => boolean) => values.find(fn); if (property === "map") return (fn: (item: Medicine) => unknown) => values.map(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const stockTransactions = new Proxy([] as StockTransaction[], { get: (_, property) => { const values = all<StockTransaction>("stock_transactions"); if (property === "push") return (...items: StockTransaction[]) => { items.forEach((item) => insert("stock_transactions", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: StockTransaction) => boolean) => values.filter(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const services = new Proxy([] as Service[], { get: (_, property) => { const values = all<Service>("services"); if (property === "push") return (...items: Service[]) => { items.forEach((item) => insert("services", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Service) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Service) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const billingTransactions = new Proxy([] as BillingTransaction[], { get: (_, property) => { const values = all<BillingTransaction>("billing_transactions"); if (property === "push") return (...items: BillingTransaction[]) => { items.forEach((item) => insert("billing_transactions", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: BillingTransaction) => boolean) => values.filter(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export function persistPrescription(id: string, values: Partial<Prescription>) { update("prescriptions", id, { ...values, ...(values.safetyFlags ? { safetyFlags: JSON.stringify(values.safetyFlags) } : {}) }); }
export function persistInboxItem(id: string, values: Partial<InboxItem>) { update("inbox_items", id, values); }
export function persistMedicine(id: string, values: Partial<Medicine>) { update("medicines", id, values); }
export function removeMedicine(id: string) { remove("medicines", id); }
export function persistService(id: string, values: Partial<Service>) { update("services", id, values); }
export function removeService(id: string) { remove("services", id); }
export function persistAppointment(id: string, values: Partial<Appointment>) { update("appointments", id, values); }

function medicineStatus(stock: number, min: number): Medicine["status"] {
  return stock <= 0 ? "Out of stock" : stock <= min ? "Low stock" : "In stock";
}

/** Applies a stock movement to a medicine and records the transaction. Returns the updated medicine, or null if the medicine doesn't exist or the movement would take stock negative. */
export function applyStockTransaction(medicineId: string, type: StockTransaction["type"], quantity: number, note?: string): Medicine | null {
  const medicine = (medicines as unknown as Medicine[]).find((item) => item.id === medicineId);
  if (!medicine) return null;
  const delta = type === "out" ? -quantity : quantity;
  const nextStock = medicine.currentStock + delta;
  if (nextStock < 0) return null;
  const status = medicineStatus(nextStock, medicine.minStock);
  persistMedicine(medicineId, { currentStock: nextStock, status });
  stockTransactions.push({ id: `stx-${Date.now()}`, medicineId, medicineName: medicine.name, type, quantity, note, createdAt: new Date().toISOString() });
  return { ...medicine, currentStock: nextStock, status };
}

// Illustrative demo-only clinical reference data for the Safety Engine. Not a real drug database.
export const KNOWN_ALLERGIES: Record<string, string[]> = { "RM-102": ["Penicillin"], "AK-118": [], "VN-306": ["Sulfa drugs"] };
export const KNOWN_ACTIVE_MEDICATIONS: Record<string, string[]> = { "RM-102": ["Metformin"], "AK-118": ["Levothyroxine"], "VN-306": ["Atorvastatin"] };
export const KNOWN_INTERACTIONS: Record<string, string[]> = { Warfarin: ["Aspirin", "Ibuprofen"], Metformin: ["Contrast dye"], Atorvastatin: ["Clarithromycin"] };
export const profileSettings = getProfileSettings();

export function persistInsight(id: string, values: Partial<Insight>) { update("insights", id, values); }
export function persistScribeNote(id: string, values: Partial<ScribeNote>) { update("scribe_notes", id, values); }
export function persistProfileSettings() { saveProfileSettings(profileSettings); }

export function json<T>(data: T, status = 200) {
  return NextResponse.json({ ok: status < 400, data }, { status });
}

export function error(message: string, status = 400, details?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { message, ...(details ? { details } : {}) } }, { status });
}

export async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function requiredString(value: unknown, field: string, maxLength = 200): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength ? value.trim() : null;
}

export function optionalString(value: unknown, maxLength = 200): string | undefined {
  return typeof value === "string" && value.trim().length <= maxLength ? value.trim() : undefined;
}

export function requiredNumber(value: unknown, min = 0): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(num) && num >= min ? num : null;
}

export function patientById(id: string) {
  return patients.find((patient) => patient.id === id);
}

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
