import { error, json, patientById, persistScribeNote, readObject, requiredString, scribeNotes, ScribeNote } from "../_lib/demo";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const patientId = new URL(request.url).searchParams.get("patientId");
  const notes = patientId ? scribeNotes.filter((note) => note.patientId === patientId) : scribeNotes;
  return json({ notes });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const transcript = requiredString(body.transcript, "transcript", 5000);
  if (!transcript) return error("transcript is required.");
  const patientId = body.patientId === undefined ? undefined : requiredString(body.patientId, "patientId", 30);
  if (body.patientId !== undefined && !patientId) return error("patientId must be a non-empty string.");
  if (patientId && !patientById(patientId)) return error("Patient not found.", 404);
  const note: ScribeNote = {
      id: `note-${Date.now()}`,
      patientId: patientId ?? null,
      status: "draft",
      subjective: transcript,
      objective: "Vitals and examination findings require clinician entry.",
      assessment: "Review the generated draft against the consultation.",
      plan: "Clinician to confirm assessment, investigations, and follow-up.",
      updatedAt: new Date().toISOString(),
      disclaimer: "Demo draft only; review and edit before saving or approving.",
  };
  scribeNotes.push(note);
  return json({ note, disclaimer: "Demo draft only; review and edit before saving or approving." }, 201);
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
