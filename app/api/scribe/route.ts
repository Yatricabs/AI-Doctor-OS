import { addScribeNote, error, json, listScribeNotes, nowIso, patientById, persistScribeNote, readObject, requiredString, safeRoute, scribeNoteById, type ScribeNote } from "../_lib/demo";
import { aiComplete, aiConfigured, MODELS } from "../_lib/ai";
import { buildScribeMessages, parseSoapDraft } from "../_lib/prompts";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const patientId = new URL(request.url).searchParams.get("patientId");
  const notes = await listScribeNotes(patientId ?? undefined);
  return json({ notes });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const transcript = requiredString(body.transcript, "transcript", 5000);
  if (!transcript) return error("transcript is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  let patientName: string | undefined;
  if (patientId) {
    const p = await patientById(patientId);
    if (!p) return error("Patient not found.", 404);
    patientName = p.name;
  }

  // Default template fields (used as-is when AI is off, or if AI output can't be parsed).
  let soap = {
    subjective: transcript,
    objective: "Vitals and examination findings require clinician entry.",
    assessment: "Review the generated draft against the consultation.",
    plan: "Clinician to confirm assessment, investigations, and follow-up.",
  };

  if (aiConfigured()) {
    try {
      const raw = await aiComplete(
        buildScribeMessages(transcript, patientName ? { name: patientName } : undefined),
        { model: MODELS.scribe, temperature: 0.3, maxTokens: 900 }
      );
      const parsed = parseSoapDraft(raw);
      if (parsed) soap = parsed;
    } catch {
      /* fall back to the template on any AI failure */
    }
  }

  const note: ScribeNote = {
    id: `note-${Date.now()}`,
    patientId: patientId ?? null,
    status: "draft",
    ...soap,
    updatedAt: nowIso(),
    disclaimer: "AI draft only; review and edit before saving or approving.",
  };
  await addScribeNote(note);
  return json({ note, disclaimer: "AI draft only; review and edit before saving or approving." }, 201);
});

export const PATCH = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const noteId = requiredString(body.noteId, "noteId", 80);
  const action = requiredString(body.action, "action", 20);
  if (!noteId || !action || !["save", "approve"].includes(action)) return error("noteId and action (save or approve) are required.");
  const note = await scribeNoteById(noteId);
  if (!note) return error("SOAP note not found.", 404);
  for (const field of ["subjective", "objective", "assessment", "plan"] as const) {
    if (body[field] !== undefined) {
      const value = requiredString(body[field], field, 5000);
      if (!value) return error(`${field} must be a non-empty string.`);
      note[field] = value;
    }
  }
  note.status = action === "approve" ? "approved" : "saved";
  note.updatedAt = nowIso();
  await persistScribeNote(note.id, note);
  return json({ note });
});
