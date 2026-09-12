// AI training-data capture — the foundation for our own future model.
//   POST  {workflow, aiOutput, patientId?, model?, inputContext?, outputType?, source?}
//         -> append-only log of an AI generation with its input+output.
//   PATCH {id, feedback?, correctedOutput?, rating?}
//         -> attach clinician feedback (accepted/edited/rejected + correction).
//   GET   ?workflow=&limit=  -> recent records (for building the dataset later).
import { error, generateId, insert, json, nowIso, query, readObject, requiredString, safeRoute, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

const FEEDBACK = ["accepted", "edited", "rejected"];

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");

  const workflow = requiredString(body.workflow, "workflow", 80);
  if (!workflow) return error("workflow is required.");
  const aiOutput = typeof body.aiOutput === "string" ? body.aiOutput : "";
  if (!aiOutput.trim()) return error("aiOutput is required.");

  const id = generateId("train");
  const now = nowIso();
  const ctx = body.inputContext;
  await insert("ai_training_data", {
    id,
    workflow,
    patientId: typeof body.patientId === "string" ? body.patientId : null,
    model: typeof body.model === "string" ? body.model.slice(0, 120) : null,
    inputContext: ctx == null ? null : typeof ctx === "string" ? ctx.slice(0, 20000) : JSON.stringify(ctx).slice(0, 20000),
    aiOutput: aiOutput.slice(0, 20000),
    outputType: typeof body.outputType === "string" ? body.outputType.slice(0, 20) : "text",
    feedback: null,
    correctedOutput: null,
    rating: null,
    source: typeof body.source === "string" ? body.source.slice(0, 40) : "app",
    createdAt: now,
    updatedAt: now,
  });
  return json({ id }, 201);
});

export const PATCH = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");
  const id = requiredString(body.id, "id", 120);
  if (!id) return error("id is required.");

  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (typeof body.feedback === "string") {
    if (!FEEDBACK.includes(body.feedback)) return error("feedback must be accepted, edited or rejected.");
    patch.feedback = body.feedback;
  }
  if (typeof body.correctedOutput === "string") patch.correctedOutput = body.correctedOutput.slice(0, 20000);
  if (body.rating !== undefined) {
    const r = Math.trunc(Number(body.rating));
    if (!Number.isFinite(r) || r < 1 || r > 5) return error("rating must be 1-5.");
    patch.rating = r;
  }
  await update("ai_training_data", id, patch);
  return json({ ok: true, id });
});

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const workflow = searchParams.get("workflow");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));
  const rows = workflow
    ? await query("SELECT * FROM ai_training_data WHERE workflow = ? ORDER BY created_at DESC LIMIT ?", [workflow, limit])
    : await query("SELECT * FROM ai_training_data ORDER BY created_at DESC LIMIT ?", [limit]);
  return json({ records: rows, total: rows.length });
});
