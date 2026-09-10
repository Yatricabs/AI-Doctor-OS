import { error, json, patientById, readObject, requiredString } from "../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const transcript = requiredString(body.transcript, "transcript", 5000);
  if (!transcript) return error("transcript is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  if (patientId && !patientById(patientId)) return error("Patient not found.", 404);
  return json({
    note: {
      patientId: patientId ?? null,
      status: "draft",
      subjective: transcript,
      objective: "Vitals and examination findings require clinician entry.",
      assessment: "Review the generated draft against the consultation.",
      plan: "Clinician to confirm assessment, investigations, and follow-up.",
      disclaimer: "Demo draft only; review and edit before saving or signing.",
    },
  }, 201);
}
