import { error, json, patientById, persistScribeNote, readObject, requiredString, scribeNotes, ScribeNote } from "../_lib/demo";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const patientId = new URL(request.url).searchParams.get("patientId");
  const notes = patientId ? scribeNotes.filter((note) => note.patientId === patientId) : scribeNotes;
  return json({ notes });
}

// AI generation happens client-side (Puter.js, "User-Pays" — see lib/puter-ai.ts)
// so this route never calls a paid AI service itself. It accepts the
// already-generated draft as `generated` and falls back to a plain canned
// draft when the client couldn't produce one (Puter unavailable, user
// declined sign-in, etc.) — this route must never depend on AI to respond.
export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const transcript = requiredString(body.transcript, "transcript", 5000);
  if (!transcript) return error("transcript is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  const patient = patientId ? patientById(patientId) : undefined;
  if (patientId && !patient) return error("Patient not found.", 404);

  const generated = body.generated && typeof body.generated === "object" ? (body.generated as { subjective?: string; objective?: string; assessment?: string; plan?: string }) : null;
  const aiGenerated = Boolean(generated?.subjective || generated?.assessment);

  const note: ScribeNote = {
    id: `note-${Date.now()}`,
    patientId: patientId ?? null,
    status: "draft",
    subjective: generated?.subjective || transcript,
    objective: generated?.objective || "Vitals and examination findings require clinician entry.",
    assessment: generated?.assessment || "Review the generated draft against the consultation.",
    plan: generated?.plan || "Clinician to confirm assessment, investigations, and follow-up.",
    updatedAt: new Date().toISOString(),
    disclaimer: "AI-drafted note; review and edit before saving or approving. Not a finalized clinical record.",
  };
  scribeNotes.push(note);
  return json({ note, aiGenerated, disclaimer: note.disclaimer }, 201);
}

export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const noteId = requiredString(body.noteId, "noteId", 80);
  const action = requiredString(body.action, "action", 20);
  if (!noteId || !action || !["save", "approve"].includes(action)) return error("noteId and action (save or approve) are required.");
  const note = scribeNotes.find((item) => item.id === noteId);
  if (!note) return error("SOAP note not found.", 404);
  for (const field of ["subjective", "objective", "assessment", "plan"] as const) {
    if (body[field] !== undefined) {
      const value = requiredString(body[field], field, 5000);
      if (!value) return error(`${field} must be a non-empty string.`);
      note[field] = value;
    }
  }
  note.status = action === "approve" ? "approved" : "saved";
  note.updatedAt = new Date().toISOString();
  persistScribeNote(note.id, note);
  return json({ note });
}
