import { error, json, optionalString, patientById, readObject, requiredString, safeRoute } from "../_lib/demo";
import { aiComplete, aiConfigured, MODELS } from "../_lib/ai";
import { buildSymptomMessages } from "../_lib/prompts";
import { evaluateClinicalReasoning } from "@/lib/clinicalReasoningClient";

export const dynamic = "force-dynamic";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const symptoms = requiredString(body.symptoms, "symptoms", 2000);
  if (!symptoms) return error("symptoms is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");

  let patientName: string | undefined;
  if (patientId) {
    const p = await patientById(patientId);
    if (!p) return error("Patient not found.", 404);
    patientName = p.name;
  }

  const duration = optionalString(body.duration, 100);
  const severity = optionalString(body.severity, 40);
  const associatedSymptoms = optionalString(body.associatedSymptoms, 1000);
  const medicines = optionalString(body.medicines, 1000);

  // Real AI triage support via Puter when configured.
  if (aiConfigured()) {
    const text = await aiComplete(
      buildSymptomMessages(
        { symptoms, duration, severity, associatedSymptoms, medicines },
        patientName ? { name: patientName } : undefined
      ),
      { model: MODELS.symptom, temperature: 0.4, maxTokens: 700 }
    );
    return json({
      text,
      reviewRequired: true,
      disclaimer: "AI triage support only; it organises information and is not a diagnosis.",
    });
  }

  // Use AI UPCHAR Clinical Reasoning (Proprietary Gateway or Clinical Safety Floor)
  const clinicalResult = await evaluateClinicalReasoning({
    patient_context: {
      patientId: patientId ?? null,
      patientName: patientName ?? null,
    },
    current_answer: [
      symptoms,
      duration ? `Duration: ${duration}` : "",
      severity ? `Severity: ${severity}` : "",
      associatedSymptoms ? `Associated: ${associatedSymptoms}` : "",
      medicines ? `Medicines: ${medicines}` : "",
    ].filter(Boolean).join(". "),
    semantic_context: {
      symptoms,
      duration,
      severity,
      associatedSymptoms,
      medicines,
    },
    safety_state: {
      status: "CLEAR",
    },
    retrieved_evidence: [],
  });

  return json({
    analysis: {
      patientId: patientId ?? null,
      input: symptoms,
      duration: duration ?? (clinicalResult.semantic_interpretation.temporal_facts?.[0] || "Not provided"),
      severity: severity ?? "Not provided",
      associatedSymptoms: associatedSymptoms ?? "None provided",
      medicines: medicines ?? "None provided",
      questions: [
        clinicalResult.next_best_question || "When did this start?",
        "How severe is it on a scale of 1 to 10?",
        "What triggers or relieves it?",
        "Which medicines are being taken?",
      ],
      triage: clinicalResult.recommended_action === "SAFETY_REVIEW"
        ? "emergency or urgent clinician review"
        : "schedule clinician review",
      redFlags: clinicalResult.recommended_action === "SAFETY_REVIEW"
        ? "Urgent safety flag detected: immediate clinical attention advised."
        : "Escalate immediately if symptoms are severe, rapidly worsening, or associated with an emergency warning sign.",
      clinicalConsiderations: clinicalResult.clinical_considerations,
      recommendedAction: clinicalResult.recommended_action,
      source: clinicalResult.source,
      disclaimer: clinicalResult.disclaimer,
    },
  });
});
