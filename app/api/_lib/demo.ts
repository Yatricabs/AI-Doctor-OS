import { NextResponse } from "next/server";
import { all, getProfileSettings, insert, saveProfileSettings, update } from "./database";

export type Patient = {
  id: string;
  name: string;
  initials: string;
  appointment: string;
  status: "Stable" | "Waiting" | "In review";
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

export const patients = new Proxy([] as Patient[], { get: (_, property) => { const values = all<Patient>("patients"); if (property === "push") return (...items: Patient[]) => { items.forEach((item) => insert("patients", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Patient) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Patient) => boolean) => values.find(fn); if (typeof property === "string" && /^\d+$/.test(property)) return values[Number(property)]; return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const reports = new Proxy([] as Report[], { get: (_, property) => { const values = all<Report>("reports"); if (property === "push") return (...items: Report[]) => { items.forEach((item) => insert("reports", item)); return values.length + items.length; }; if (property === "length") return values.length; if (property === "filter") return (fn: (item: Report) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Report) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const scribeNotes = new Proxy([] as ScribeNote[], { get: (_, property) => { const values = all<ScribeNote>("scribe_notes"); if (property === "push") return (...items: ScribeNote[]) => { items.forEach((item) => insert("scribe_notes", item)); return values.length + items.length; }; if (property === "filter") return (fn: (item: ScribeNote) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: ScribeNote) => boolean) => values.find(fn); if (property === "length") return values.length; return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
export const insights = new Proxy([] as Insight[], { get: (_, property) => { const values = all<Insight>("insights"); if (property === "filter") return (fn: (item: Insight) => boolean) => values.filter(fn); if (property === "find") return (fn: (item: Insight) => boolean) => values.find(fn); return (values as unknown as Record<PropertyKey, unknown>)[property]; } });
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
