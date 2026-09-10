import { error, json, patientById, readObject, requiredString } from "../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const symptoms = requiredString(body.symptoms, "symptoms", 2000);
  if (!symptoms) return error("symptoms is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  if (patientId && !patientById(patientId)) return error("Patient not found.", 404);
  return json({
    analysis: {
      patientId: patientId ?? null,
      input: symptoms,
      questions: ["When did this start?", "How severe is it?", "What triggers or relieves it?", "Which medicines are being taken?"],
      triage: "schedule clinician review",
      redFlags: "Escalate immediately if symptoms are severe, rapidly worsening, or associated with an emergency warning sign.",
      disclaimer: "This demo organises information and is not a diagnosis.",
    },
  });
}
