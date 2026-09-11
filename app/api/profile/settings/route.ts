import { error, json, profileSettings, readObject, requiredString } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ settings: profileSettings });
}

export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const next = { ...profileSettings };
  for (const field of ["fullName", "specialty", "clinicBio"] as const) {
    if (field in body) {
      const value = requiredString(body[field], field, field === "clinicBio" ? 500 : 100);
      if (!value) return error(`${field} must be a non-empty string.`);
      next[field] = value;
    }
  }
  if (body.notifications !== undefined) {
    if (!body.notifications || typeof body.notifications !== "object" || Array.isArray(body.notifications)) return error("notifications must be an object.");
    const notifications = { ...profileSettings.notifications };
    for (const field of ["urgentFollowUps", "weeklySummary", "twoStepSignIn"] as const) {
      const value = (body.notifications as Record<string, unknown>)[field];
      if (value !== undefined) {
        if (typeof value !== "boolean") return error(`${field} must be a boolean.`);
        notifications[field] = value;
      }
    }
    next.notifications = notifications;
  }
  Object.assign(profileSettings, next);
  return json({ settings: profileSettings });
}
