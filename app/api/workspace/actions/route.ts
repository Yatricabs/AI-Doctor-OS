import { error, json, readObject, requiredString } from "../../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const action = requiredString(body.action, "action", 60);
  if (!action) return error("action is required.");
  return json({ action: { id: `action-${Date.now()}`, action, status: "queued", message: `${action} is ready for clinician review.` } }, 201);
}
