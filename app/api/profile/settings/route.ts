import { error, getProfileSettings, json, type ProfileSettings, readObject, requiredString, safeRoute, saveProfile } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async () => {
  const settings = await getProfileSettings();
  return json({ settings });
});

export const PATCH = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");

  const current = await getProfileSettings();
  const next: ProfileSettings = { ...current, notifications: { ...current.notifications } };

  for (const field of ["fullName", "specialty", "clinicBio"] as const) {
    if (field in body) {
      const value = requiredString(body[field], field, field === "clinicBio" ? 500 : 100);
      if (!value) return error(`${field} must be a non-empty string.`);
      next[field] = value;
    }
  }

  if (body.notifications !== undefined) {
    if (!body.notifications || typeof body.notifications !== "object" || Array.isArray(body.notifications)) return error("notifications must be an object.");
    for (const field of ["urgentFollowUps", "weeklySummary", "twoStepSignIn"] as const) {
      const value = (body.notifications as Record<string, unknown>)[field];
      if (value !== undefined) {
        if (typeof value !== "boolean") return error(`${field} must be a boolean.`);
        next.notifications[field] = value;
      }
    }
  }

  await saveProfile(next);
  return json({ settings: next });
});
