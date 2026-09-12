import { error, generateId, getPatientContext, insert, json, nowIso, query, queryOne, readObject, requiredString, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const visitId = searchParams.get("visitId");

    if (!patientId) return error("patientId is required");

    // Try to find existing brief
    const sql = visitId
      ? "SELECT * FROM pre_visit_briefs WHERE patient_id = ? AND visit_id = ? ORDER BY created_at DESC LIMIT 1"
      : "SELECT * FROM pre_visit_briefs WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1";
    const params = visitId ? [patientId, visitId] : [patientId];
    const brief = await queryOne<Record<string, unknown>>(sql, params);

    if (brief) {
      // Parse JSON fields
      const parsed = {
        ...brief,
        missingInfo: safeParseArray(brief.missingInfo),
        attentionSignals: safeParseArray(brief.attentionSignals),
        patientQuestions: safeParseArray(brief.patientQuestions),
        aiConsiderations: safeParseArray(brief.aiConsiderations),
      };

      // Enrich with patient context
      const context = await getPatientContext(patientId);
      return json({ brief: parsed, context });
    }

    // Generate a fresh brief from patient data
    const context = await getPatientContext(patientId);
    if (!context) return error("Patient not found", 404);

    const { patient, medications, allergies, conditions, followUps } = context;

    const medList = medications.map((m) => `${m.name} ${m.dose} ${m.frequency}`).join(", ") || "None on record";
    const allergyList = allergies.map((a) => `${a.allergen} (${a.severity})`).join(", ") || "NKDA";
    const conditionList = conditions.map((c) => c.name).join(", ") || "None on record";

    const missingInfo: string[] = [];
    if (!allergies.length) missingInfo.push("Drug allergy status not confirmed");
    if (!medications.length) missingInfo.push("Current medication list not on file");
    if (!conditions.length) missingInfo.push("Active conditions not documented");

    const attentionSignals: Record<string, string>[] = [];
    if (allergies.some((a) => a.severity === "severe")) {
      const severeAllergies = allergies.filter((a) => a.severity === "severe");
      attentionSignals.push({
        type: "allergy",
        title: "Severe allergy on file",
        detail: `${severeAllergies.map((a) => `${a.allergen}: ${a.reaction}`).join("; ")}`,
        severity: "high",
        source: "allergy_records",
      });
    }
    if (followUps.some((f) => f.status === "pending")) {
      attentionSignals.push({
        type: "follow_up",
        title: "Pending follow-up items",
        detail: `${followUps.filter((f) => f.status === "pending").map((f) => f.title).join("; ")}`,
        severity: "medium",
        source: "follow_ups",
      });
    }

    const historySummary = `${patient.gender ?? ""} patient. Known conditions: ${conditionList}. Allergies: ${allergyList}.`;
    const medicationSummary = `Active medications: ${medList}.`;

    // Get last visit for "what changed"
    const lastVisit = await queryOne<Record<string, unknown>>(
      "SELECT * FROM visits WHERE patient_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
      [patientId]
    );
    const whatChanged = lastVisit
      ? `Patient returning since last visit. Review any new reports and medication changes.`
      : `New patient — no prior visit history in system.`;

    const appointment = await queryOne<Record<string, unknown>>(
      "SELECT * FROM appointments WHERE patient_id = ? AND status IN ('confirmed','checked_in') ORDER BY appointment_date ASC, appointment_time ASC LIMIT 1",
      [patientId]
    );

    const queueEntry = await queryOne<Record<string, unknown>>(
      "SELECT * FROM queue_entries WHERE patient_id = ? AND status IN ('waiting','called','in_consultation') ORDER BY created_at DESC LIMIT 1",
      [patientId]
    );
    const queueStatus = queueEntry
      ? `Position ${queueEntry.position ?? "?"} · ${String(queueEntry.status).replace("_", " ")} · Token ${queueEntry.tokenNumber}`
      : "Not yet in queue";

    const aiConsiderations = generateAiConsiderations(conditions, medications, allergies);
    const intakeSession = await queryOne<Record<string, unknown>>(
      "SELECT * FROM intake_sessions WHERE patient_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
      [patientId]
    );
    const patientQuestions: string[] = [];
    if (intakeSession) {
      const qs = await query<Record<string, unknown>>(
        "SELECT * FROM intake_responses WHERE intake_session_id = ? AND question_key IN ('questions','chief_complaint','how_are_you')",
        [String(intakeSession.id)]
      );
      qs.forEach((q) => { if (q.responseValue && q.responseValue !== "__skipped__") patientQuestions.push(String(q.responseValue)); });
    }

    const briefId = generateId("brief");
    const newBrief = {
      id: briefId,
      visitId: visitId ?? generateId("visit"),
      patientId,
      visitReason: appointment ? String(appointment.reason ?? "Not specified") : "Not specified",
      patientType: String(patient.patientType ?? "returning"),
      historySummary,
      medicationSummary,
      whatChanged,
      missingInfo: JSON.stringify(missingInfo),
      attentionSignals: JSON.stringify(attentionSignals),
      patientQuestions: JSON.stringify(patientQuestions),
      aiConsiderations: JSON.stringify(aiConsiderations),
      queueStatus,
      aiLabel: "AI_GENERATED",
      confidence: "moderate",
      sourceIds: JSON.stringify(["patients", "medications", "allergies", "conditions", "follow_ups"]),
      reviewStatus: "generated",
      createdAt: nowIso(),
    };
    await insert("pre_visit_briefs", newBrief);

    return json({
      brief: {
        ...newBrief,
        missingInfo,
        attentionSignals,
        patientQuestions,
        aiConsiderations,
      },
      context,
      disclaimer: "AI-generated pre-visit context. Review all information before clinical use. Sources: patient record, medications, allergies, conditions.",
    });
  } catch (err) {
    console.error("Pre-visit GET error:", err);
    return error(`Server error: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readObject(request);
    if (!body) return error("Invalid request body");

    const action = requiredString(body.action, "action");

    if (action === "review") {
      const briefId = requiredString(body.briefId, "briefId");
      const reviewStatus = requiredString(body.reviewStatus, "reviewStatus");
      if (!briefId || !reviewStatus) return error("briefId and reviewStatus required");
      await update("pre_visit_briefs", briefId, { reviewStatus, reviewedBy: "user-doc-001", reviewedAt: nowIso() });
      const brief = await queryOne<Record<string, unknown>>("SELECT * FROM pre_visit_briefs WHERE id = ?", [briefId]);
      return json({ brief });
    }

    return error("Unknown action");
  } catch (err) {
    console.error("Pre-visit POST error:", err);
    return error(`Server error: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function safeParseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function generateAiConsiderations(
  conditions: { name: string }[],
  medications: { name: string; dose?: string }[],
  allergies: { allergen: string; severity: string }[]
): string[] {
  const considerations: string[] = [];
  const condNames = conditions.map((c) => c.name.toLowerCase());
  const medNames = medications.map((m) => m.name.toLowerCase());

  if (condNames.some((c) => c.includes("diabetes"))) {
    considerations.push("Monitor HbA1c trend. Target < 7% for most patients. Consider renal function if on Metformin long-term.");
  }
  if (condNames.some((c) => c.includes("hypertension"))) {
    considerations.push("Blood pressure target < 130/80 mmHg for most patients. Review current BP medication efficacy.");
  }
  if (condNames.some((c) => c.includes("thyroid") || c.includes("hypothyroid"))) {
    considerations.push("TSH target range 0.5–2.5 mIU/L for most patients on levothyroxine. Review dose adjustment response.");
  }
  if (condNames.some((c) => c.includes("heart") || c.includes("cardiac") || c.includes("ischaemic"))) {
    considerations.push("Cardioprotective medications review. Ensure aspirin, statin, and ACE inhibitor or ARB are considered if indicated.");
  }
  if (medNames.some((m) => m.includes("metformin"))) {
    considerations.push("Metformin: Check eGFR if not done recently. Contraindicated if eGFR < 30. Dose adjustment at eGFR 30-45.");
  }
  if (medNames.some((m) => m.includes("statin") || m.includes("atorvastatin") || m.includes("rosuvastatin"))) {
    considerations.push("Statin therapy: Check LFT and CK if patient reports muscle symptoms. Review LDL target achievement.");
  }
  if (allergies.some((a) => a.severity === "severe")) {
    considerations.push("[SAFETY] Severe allergy documented. Ensure no cross-reactive drugs in any new prescription.");
  }
  if (considerations.length === 0) {
    considerations.push("Review patient history and current symptoms. Standard clinical assessment applies.");
  }
  return considerations;
}
