export const dynamic = "force-dynamic";

import { RED_FLAG_KEYWORDS, error, inboxItems, json, optionalString, patientById, readObject, requiredString } from "../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const symptoms = requiredString(body.symptoms, "symptoms", 2000);
  if (!symptoms) return error("symptoms is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  const patient = patientId ? patientById(patientId) : undefined;
  if (patientId && !patient) return error("Patient not found.", 404);
  const duration = optionalString(body.duration, 100);
  const severity = optionalString(body.severity, 40);
  const associatedSymptoms = optionalString(body.associatedSymptoms, 1000);
  const medicines = optionalString(body.medicines, 1000);

  const lower = symptoms.toLowerCase();
  const matchedFlags = RED_FLAG_KEYWORDS.filter((keyword) => lower.includes(keyword));
  const isUrgent = matchedFlags.length > 0;

  if (isUrgent) {
    inboxItems.push({
      id: `inbox-redflag-${Date.now()}`,
      type: "red_flag",
      title: `Red-flag symptoms reported${patient ? ` — ${patient.name}` : ""}`,
      detail: `Symptom intake mentioned: ${matchedFlags.join(", ")}. This does not diagnose or triage automatically — route to the facility's emergency pathway and review immediately.`,
      patientId: patientId ?? undefined,
      patientName: patient?.name,
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  // Follow-up questions: AI-tailored for routine cases only. The urgent path
  // above (detection, inbox routing, triage label) is intentionally pure
  // keyword matching with no AI dependency — a safety-critical check must
  // never depend on an optional third-party service being reachable.
  let questions = isUrgent
    ? ["Is the patient safe and breathing right now?", "Is anyone with the patient who can call for emergency help?"]
    : ["When did this start?", "How severe is it?", "What triggers or relieves it?", "Which medicines are being taken?"];
  // AI-tailored questions run client-side (Puter.js) for routine cases; this
  // route accepts them as optional pre-generated input and otherwise uses the
  // canned list above, so it never depends on a paid server-side AI call.
  let aiGenerated = false;
  if (!isUrgent && Array.isArray(body.generatedQuestions) && body.generatedQuestions.every((q: unknown) => typeof q === "string")) {
    const provided = (body.generatedQuestions as string[]).filter((q) => q.trim()).slice(0, 6);
    if (provided.length) {
      questions = provided;
      aiGenerated = true;
    }
  }

  return json({
    analysis: {
      patientId: patientId ?? null,
      input: symptoms,
      duration: duration ?? "Not provided",
      severity: severity ?? "Not provided",
      associatedSymptoms: associatedSymptoms ?? "None provided",
      medicines: medicines ?? "None provided",
      questions,
      aiGenerated,
      triage: isUrgent ? "URGENT REVIEW — do not wait for the standard queue" : "schedule clinician review",
      redFlags: isUrgent
        ? `Emergency-pathway signal detected (${matchedFlags.join(", ")}). This is a routing flag, not a diagnosis — a clinician must confirm next steps.`
        : "Escalate immediately if symptoms are severe, rapidly worsening, or associated with an emergency warning sign.",
      urgent: isUrgent,
      disclaimer: "This demo organises information and is not a diagnosis.",
    },
  });
}
