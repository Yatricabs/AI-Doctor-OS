import { NextResponse } from "next/server";

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

export const patients: Patient[] = [
  { id: "RM-102", name: "Rohan Mehta", initials: "RM", appointment: "Follow-up today · 10:30 AM", status: "Stable" },
  { id: "AK-118", name: "Ananya Kapoor", initials: "AK", appointment: "Annual wellness review · 11:00 AM", status: "Waiting" },
  { id: "VN-306", name: "Vikram Nair", initials: "VN", appointment: "Lab results review · 11:30 AM", status: "In review" },
];

export const reports: Report[] = [
  { id: "report-cbc-102", patientId: "RM-102", title: "CBC and lipid profile", type: "Lab report", date: "2026-09-10", status: "Ready for review" },
  { id: "report-rx-102", patientId: "RM-102", title: "Active prescriptions", type: "Prescription", date: "2026-09-05", status: "Reviewed" },
  { id: "report-thyroid-118", patientId: "AK-118", title: "Thyroid panel", type: "Lab report", date: "2026-09-09", status: "Ready for review" },
];

export const scribeNotes: ScribeNote[] = [];

export const insights: Insight[] = [
  { id: "insight-1", title: "Follow-up queue", detail: "Three follow-ups need review before the next clinic block.", priority: "High", status: "open" },
  { id: "insight-2", title: "Report trend", detail: "Rohan Mehta's HbA1c improved while LDL remains above target.", priority: "Medium", status: "open" },
  { id: "insight-3", title: "Documentation quality", detail: "Two draft notes need clinician approval before signing.", priority: "Low", status: "open" },
];

export let profileSettings: ProfileSettings = {
  fullName: "Dr. Ananya Arya",
  specialty: "General Medicine",
  clinicBio: "Clinician focused on practical, preventive adult care.",
  notifications: { urgentFollowUps: true, weeklySummary: true, twoStepSignIn: true },
};

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
