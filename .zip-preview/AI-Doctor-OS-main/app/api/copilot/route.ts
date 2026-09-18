import { error, json, patientById, readObject, requiredString } from "../_lib/demo";

// Deferred to the Doctor Workspace phase (see restructuring notes). AI
// generation for this feature runs client-side (Puter.js) when active; this
// route is a safe canned-response fallback so it never depends on a paid
// server-side AI call.
export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const question = requiredString(body.question, "question", 2000);
  const patientId = requiredString(body.patientId, "patientId", 30);
  if (!question || !patientId) return error("question and patientId are required.");
  const patient = patientById(patientId);
  if (!patient) return error("Patient not found.", 404);

  const generated = typeof body.generated === "string" ? body.generated.trim() : "";
  return json({
    response: generated || `For "${question}", start with the ${patient.name} timeline and source documents, document your reasoning, and keep the final decision with the clinician.`,
    aiGenerated: Boolean(generated),
    patient,
    sources: ["patient timeline", "available medical records"],
    reviewRequired: true,
    disclaimer: "Decision support only; it does not diagnose, prescribe, or sign clinical actions.",
  });
}
