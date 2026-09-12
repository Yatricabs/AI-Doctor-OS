import { error, json, patientById, readObject, requiredString, safeRoute } from "../_lib/demo";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const question = requiredString(body.question, "question", 2000);
  const patientId = requiredString(body.patientId, "patientId", 30);
  if (!question || !patientId) return error("question and patientId are required.");
  const patient = await patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  return json({
    response: `For "${question}", start with the ${patient.name} timeline and source documents, document your reasoning, and keep the final decision with the clinician.`,
    patient,
    sources: ["patient timeline", "available medical records"],
    reviewRequired: true,
    disclaimer: "Demo decision support only; it does not diagnose, prescribe, or sign clinical actions.",
  });
});
