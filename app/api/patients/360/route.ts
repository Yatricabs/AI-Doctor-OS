import { error, json, patientById, query, queryOne, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

// A pre_visit_briefs row (columns written by app/api/pre-visit and appointment-intake).
type BriefRow = {
  id?: string;
  visitReason?: string;
  patientType?: string;
  historySummary?: string;
  medicationSummary?: string;
  whatChanged?: string;
  missingInfo?: string;
  attentionSignals?: string;
  patientQuestions?: string;
  aiConsiderations?: string;
  aiReport?: string;
  research?: string;
  reportJson?: string;
  aiLabel?: string;
  createdAt?: string;
};

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => (x && typeof x === "object" ? String((x as { detail?: string; title?: string }).detail ?? (x as { title?: string }).title ?? "") : String(x)))
          .filter(Boolean);
      }
    } catch {
      // A plain string that is not JSON — treat as a single-item list.
      return [value.trim()];
    }
  }
  return [];
};

const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));

// Maps a pre_visit_briefs row into the doctor-app PreVisitReport shape the
// Patient 360 "AI Summary" card renders. Prefers the full serialized report
// (reportJson) and falls back to the individual columns for older briefs.
function mapBriefToSummary(row: BriefRow | null) {
  if (!row) return null;

  let full: Record<string, unknown> = {};
  if (row.reportJson) {
    try { full = JSON.parse(row.reportJson) as Record<string, unknown>; } catch { full = {}; }
  }

  const pick = <T,>(fromFull: T, fromColumn: T): T => {
    const value = fromFull as unknown;
    if (Array.isArray(value)) return (value.length ? fromFull : fromColumn);
    if (typeof value === "string") return (value.trim() ? fromFull : fromColumn);
    if (value == null) return fromColumn;
    return fromFull;
  };

  const chiefComplaint = pick(str(full.chiefComplaint), str(row.visitReason));
  const history = pick(str(full.history), str(row.historySummary));
  const currentIssue = pick(str(full.currentIssue), str(row.whatChanged));
  const assessment = str(full.assessment);
  const possibleConditions = pick(toArray(full.considerations), toArray(row.aiConsiderations));
  const redFlags = pick(toArray(full.redFlags), toArray(row.attentionSignals));
  const narrative = pick(str(full.summary), str(row.aiReport));

  const testsInitial = toArray(full.testsInitial);
  const testsIfSevere = toArray(full.testsIfSevere);
  const legacyTests = [...testsInitial, ...testsIfSevere];

  const urgencyLevel = ["routine", "opd", "urgent", "admit", "emergency"].includes(String(full.urgency))
    ? (String(full.urgency) as "routine" | "opd" | "urgent" | "admit" | "emergency")
    : undefined;

  const visitType = str(row.patientType).toLowerCase().includes("return") ? "returning" : "new";

  // Severity: prefer an explicit numeric score in the report; else derive a hint from urgency.
  const severityRaw = full.severityScore ?? full.severity;
  const severityScore = typeof severityRaw === "number" ? severityRaw : (typeof severityRaw === "string" && severityRaw.trim() && !Number.isNaN(Number(severityRaw)) ? Number(severityRaw) : undefined);
  const associatedSymptoms = toArray(full.associatedSymptoms);
  // Key concerns: explicit field, else fall back to the top considerations / red flags.
  const keyConcerns = pick(toArray(full.keyConcerns), (possibleConditions.length ? possibleConditions : redFlags).slice(0, 4));

  return {
    // Legacy fields (card + any older consumers).
    problemSummary: currentIssue || chiefComplaint || narrative,
    fullHistory: history,
    provisionalDiagnosis: possibleConditions[0] ?? assessment,
    furtherTestsNeeded: legacyTests.join(", "),
    recommendedTests: legacyTests,
    recommendedTreatment: [...toArray(full.treatmentMedicines), ...toArray(full.treatmentMeasures)].join("; "),
    urgency: urgencyLevel === "emergency" ? "Emergency" : urgencyLevel === "admit" ? "Admit for observation" : "OPD",
    surgeryLikely: str(full.surgeryNote),
    aiGenerated: true,
    // Rich sections.
    chiefComplaint,
    duration: str(full.duration),
    likelyCause: assessment,
    possibleConditions,
    diagnosisConfidence: ["low", "moderate", "high"].includes(String(full.diagnosisConfidence))
      ? (String(full.diagnosisConfidence) as "low" | "moderate" | "high")
      : undefined,
    recommendedTestsInitial: testsInitial,
    recommendedTestsIfSevere: testsIfSevere,
    recommendedMedicines: toArray(full.treatmentMedicines),
    treatmentMeasures: toArray(full.treatmentMeasures),
    redFlags,
    urgencyLevel,
    urgencyReason: str(full.urgencyReason),
    infoSufficient: typeof full.infoSufficient === "boolean" ? full.infoSufficient : undefined,
    infoSufficientNote: str(full.infoSufficientNote),
    nextSteps: toArray(full.nextSteps),
    narrative,
    visitType,
    generatedAt: str(row.createdAt),
    // Structured grid fields.
    severityScore,
    severityLabel: str(full.severityLabel) || "As per patient response",
    associatedSymptoms,
    keyConcerns,
    specialty: str(full.specialty),
    messageCount: typeof full.messageCount === "number" ? full.messageCount : undefined,
  };
}

export const GET = safeRoute(async (request: Request) => {
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) return error("patientId is required.");
  const patient = await patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  const [appointments, reports, prescriptions, bills, followUps, brief] = await Promise.all([
    query<Record<string, unknown>>("SELECT a.*, p.name AS patient_name FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM reports WHERE patient_id = ? ORDER BY date DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM bills WHERE patient_id = ? ORDER BY created_at DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM follow_ups WHERE patient_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 1", [patientId]),
    queryOne<BriefRow>("SELECT * FROM pre_visit_briefs WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1", [patientId]),
  ]);
  return json({
    patient,
    appointments: appointments.map((a) => ({ ...a, date: a.appointmentDate, time: a.appointmentTime, visitType: a.visitType === "follow_up" ? "Follow-up" : "New", reason: a.reason ?? "", patientName: a.patientName ?? patient.name, channel: "Web", priority: "Routine", consultationFee: 0, queuePosition: 0, briefReady: false, briefSummary: "" })),
    reports,
    prescriptions: prescriptions.map((rx) => ({ ...rx, patientId, patientName: patient.name, medication: "", dosage: "", safetyFlags: [] })),
    billing: { transactions: bills.map((bill) => ({ id: bill.id, patientId, patientName: patient.name, type: "Consultation fee", description: "Appointment billing", amount: Number(bill.total) || 0, date: bill.createdAt ?? "", createdAt: bill.createdAt ?? "" })), total: bills.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0) },
    aiSummary: mapBriefToSummary(brief),
    nextFollowUp: followUps[0] ? { date: String(followUps[0].dueDate ?? ""), time: String(followUps[0].dueTime ?? "") } : null,
  });
});
