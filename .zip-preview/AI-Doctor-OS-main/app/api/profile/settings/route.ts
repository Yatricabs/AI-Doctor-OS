import { appointments, error, inboxItems, json, persistProfileSettings, profileSettings, readObject, requiredString } from "../../_lib/demo";

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
  let justWentAway = false;
  if (body.availableToday !== undefined) {
    if (typeof body.availableToday !== "boolean") return error("availableToday must be a boolean.");
    justWentAway = profileSettings.availableToday && !body.availableToday;
    next.availableToday = body.availableToday;
  }
  Object.assign(profileSettings, next);
  persistProfileSettings();

  if (justWentAway) {
    const today = (appointments as unknown as { id: string; patientId: string; patientName: string; time: string }[]);
    for (const appt of today) {
      inboxItems.push({
        id: `inbox-reschedule-${appt.id}-${Date.now()}`,
        type: "reschedule",
        title: `${appt.patientName}'s ${appt.time} visit needs rescheduling`,
        detail: `Dr. ${profileSettings.fullName.replace(/^Dr\.\s*/, "")} was marked away. Notify the patient and offer a new slot per facility policy.`,
        patientId: appt.patientId,
        patientName: appt.patientName,
        status: "open",
        createdAt: new Date().toISOString(),
      });
    }
  }

  return json({ settings: profileSettings });
}
