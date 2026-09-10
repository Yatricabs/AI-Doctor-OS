import { error, json, readObject, requiredString } from "../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const action = requiredString(body.action, "action", 30);
  if (!action || !["start", "stop"].includes(action)) return error("action must be start or stop.");
  return json({ session: { id: `session-${Date.now()}`, status: action === "start" ? "active" : "completed", startedAt: new Date().toISOString() } });
}
