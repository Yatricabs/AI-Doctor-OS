import { error, json, patientById, readObject, requiredString, safeRoute } from "../_lib/demo";
import { aiComplete, aiConfigured, MODELS } from "../_lib/ai";
import { buildCopilotMessages } from "../_lib/prompts";

export const dynamic = "force-dynamic";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const question = requiredString(body.question, "question", 2000);
  const patientId = requiredString(body.patientId, "patientId", 30);
  if (!question || !patientId) return error("question and patientId are required.");
  const patient = await patientById(patientId);
  if (!patient) return error("Patient not found.", 404);

  // Real AI decision support when configured; otherwise a safe structured stub.
  if (aiConfigured()) {
    const response = await aiComplete(
      buildCopilotMessages(question, { name: patient.name, status: patient.status, appointment: patient.appointment }),
      { model: MODELS.copilot, temperature: 0.4, maxTokens: 700 }
    );
    return json({
      response,
      patient,
      reviewRequired: true,
      disclaimer: "AI decision support only; it does not diagnose, prescribe, or sign clinical actions.",
    });
  }

  return json({
    response: `For "${question}", start with the ${patient.name} timeline and source documents, document your reasoning, and keep the final decision with the clinician.`,
    patient,
    reviewRequired: true,
    disclaimer: "Demo decision support only; it does not diagnose, prescribe, or sign clinical actions.",
  });
});
