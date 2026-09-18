import { Appointment, BillingTransaction, appointments, billingTransactions, detectRedFlags, error, inboxItems, json, optionalString, patients, Patient, PreVisitReport, readObject, requiredString } from "../_lib/demo";

export const dynamic = "force-dynamic";

// AI question generation and report drafting now happen client-side (Puter.js
// — see lib/puter-ai.ts), so this route never calls a paid AI service. It
// only validates and stores what the client already collected/generated, and
// re-runs the deterministic red-flag check as the authoritative safety net
// (the client's own check is just for immediate chat feedback).
export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");

  const name = requiredString(body.name, "name", 100);
  const phone = requiredString(body.phone, "phone", 30);
  const age = requiredString(body.age, "age", 10);
  const sex = requiredString(body.sex, "sex", 20);
  const location = requiredString(body.location, "location", 120);
  const chiefComplaint = requiredString(body.chiefComplaint, "chiefComplaint", 2000);
  const duration = requiredString(body.duration, "duration", 100);
  if (!name || !phone || !age || !sex || !location || !chiefComplaint || !duration) {
    return error("name, phone, age, sex, location, chiefComplaint, and duration are all required.");
  }
  const preferredDate = optionalString(body.preferredDate, 40) ?? "Next available";
  const preferredTime = optionalString(body.preferredTime, 40) ?? "Any time";
  const priorConsultation = optionalString(body.priorConsultation, 300);
  const priorReports = optionalString(body.priorReports, 300);

  const rawQaLog = Array.isArray(body.qaLog) ? body.qaLog : [];
  const qaLog = rawQaLog
    .filter((turn): turn is { question: string; answer: string } => Boolean(turn) && typeof turn === "object" && typeof (turn as Record<string, unknown>).question === "string" && typeof (turn as Record<string, unknown>).answer === "string")
    .slice(0, 15)
    .map((turn) => ({ question: String(turn.question).slice(0, 500), answer: String(turn.answer).slice(0, 1000) }));

  // Authoritative deterministic safety net: re-check every piece of collected
  // text, regardless of what the client-side check or the AI report said.
  const allText = [chiefComplaint, priorConsultation, priorReports, ...qaLog.flatMap((t) => [t.question, t.answer])].join(" ");
  const flags = detectRedFlags(allText);
  const urgent = flags.length > 0;

  const rawReport = body.preVisitReport && typeof body.preVisitReport === "object" ? (body.preVisitReport as Record<string, unknown>) : null;
  const preVisitReport: PreVisitReport = {
    problemSummary: typeof rawReport?.problemSummary === "string" ? rawReport.problemSummary : `${name} reports: ${chiefComplaint} (${duration}).`,
    fullHistory: typeof rawReport?.fullHistory === "string" ? rawReport.fullHistory : [chiefComplaint, priorConsultation && `Prior consultation: ${priorConsultation}`, priorReports && `Prior reports: ${priorReports}`, ...qaLog.map((t) => `${t.question} — ${t.answer}`)].filter(Boolean).join(" "),
    provisionalDiagnosis: typeof rawReport?.provisionalDiagnosis === "string" ? rawReport.provisionalDiagnosis : "Not generated — AI unavailable for this intake. Doctor to assess from history below.",
    furtherTestsNeeded: typeof rawReport?.furtherTestsNeeded === "string" ? rawReport.furtherTestsNeeded : "Doctor to determine after reviewing history.",
    recommendedTests: Array.isArray(rawReport?.recommendedTests) ? (rawReport!.recommendedTests as unknown[]).filter((t) => typeof t === "string").slice(0, 10) as string[] : [],
    recommendedTreatment: typeof rawReport?.recommendedTreatment === "string" ? rawReport.recommendedTreatment : "Doctor to decide at consultation.",
    urgency: urgent ? "Emergency" : (rawReport?.urgency === "Admit for observation" || rawReport?.urgency === "Emergency" ? rawReport.urgency as PreVisitReport["urgency"] : "OPD"),
    surgeryLikely: typeof rawReport?.surgeryLikely === "string" ? rawReport.surgeryLikely : "Not assessed.",
    aiGenerated: Boolean(rawReport),
  };

  const patientId = `PT-${Date.now()}`;
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PT";
  const patient: Patient = { id: patientId, name, initials, appointment: `New patient · ${preferredDate} ${preferredTime}`, status: "Waiting", phone, age, sex, location };
  patients.push(patient);

  const current = appointments as unknown as Appointment[];
  const consultationFee = 500;
  const appointment: Appointment = {
    id: `appt-${Date.now()}`,
    patientId,
    patientName: name,
    channel: "Mobile app",
    date: preferredDate,
    time: preferredTime,
    priority: urgent ? "Urgent" : "Routine",
    visitType: "New",
    reason: chiefComplaint,
    consultationFee,
    status: "Scheduled",
    queuePosition: current.filter((a) => a.date === preferredDate).length + 1,
    briefReady: true,
    briefSummary: preVisitReport.problemSummary,
    missingInfo: undefined,
    qaLog,
    preVisitReport,
  };
  appointments.push(appointment);

  const billing: BillingTransaction = { id: `bill-${Date.now()}`, patientId, patientName: name, appointmentId: appointment.id, type: "Consultation fee", description: `${appointment.visitType} patient consultation`, amount: consultationFee, date: preferredDate, createdAt: new Date().toISOString() };
  billingTransactions.push(billing);

  if (urgent) {
    inboxItems.push({
      id: `inbox-redflag-${Date.now()}`,
      type: "red_flag",
      title: `Red-flag symptoms reported — ${name} (new patient)`,
      detail: `New-patient intake mentioned: ${flags.join(", ")}. This does not diagnose or triage automatically — route to the facility's emergency pathway and review immediately.`,
      patientId,
      patientName: name,
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  return json({ patient, appointment, urgent }, 201);
}
