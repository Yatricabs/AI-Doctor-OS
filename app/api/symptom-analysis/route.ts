import { error, json, optionalString, patientById, readObject, requiredString, safeRoute } from "../_lib/demo";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const symptoms = requiredString(body.symptoms, "symptoms", 2000);
  if (!symptoms) return error("symptoms is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  if (patientId && !(await patientById(patientId))) return error("Patient not found.", 404);
  const duration = optionalString(body.duration, 100);
  const severity = optionalString(body.severity, 40);
  const associatedSymptoms = optionalString(body.associatedSymptoms, 1000);
  const medicines = optionalString(body.medicines, 1000);
  return json({
    analysis: {
      patientId: patientId ?? null,
      input: symptoms,
      duration: duration ?? "Not provided",
      severity: severity ?? "Not provided",
      associatedSymptoms: associatedSymptoms ?? "None provided",
      medicines: medicines ?? "None provided",
      questions: ["When did this start?", "How severe is it?", "What triggers or relieves it?", "Which medicines are being taken?"],
      triage: "schedule clinician review",
      redFlags: "Escalate immediately if symptoms are severe, rapidly worsening, or associated with an emergency warning sign.",
      disclaimer: "This demo organises information and is not a diagnosis.",
    },
  });
});
