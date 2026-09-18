import { Appointment, appointments, error, json, optionalString, readObject, requiredString } from "../_lib/demo";

export const dynamic = "force-dynamic";

const priorityWeight: Record<Appointment["priority"], number> = { Urgent: 0, "Follow-up": 1, Routine: 2 };

export function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  const data = [...(appointments as unknown as Appointment[])]
    .filter((appt) => !date || appt.date === date)
    .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || a.queuePosition - b.queuePosition);
  return json({ appointments: data, total: data.length });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const patientName = requiredString(body.patientName, "patientName", 100);
  if (!patientName) return error("patientName is required and must be a non-empty string.");
  const channel = requiredString(body.channel, "channel", 30) as Appointment["channel"] | null;
  if (!channel || !["WhatsApp", "Voice call", "Mobile app", "Walk-in"].includes(channel)) return error("channel must be one of WhatsApp, Voice call, Mobile app, Walk-in.");
  const priority = (requiredString(body.priority, "priority", 20) as Appointment["priority"] | null) ?? "Routine";
  if (!["Urgent", "Follow-up", "Routine"].includes(priority)) return error("priority must be one of Urgent, Follow-up, Routine.");
  const visitType = (requiredString(body.visitType, "visitType", 20) as Appointment["visitType"] | null) ?? "New";
  if (!["New", "Follow-up"].includes(visitType)) return error("visitType must be New or Follow-up.");
  const date = optionalString(body.date, 20) ?? new Date().toISOString().slice(0, 10);
  const time = optionalString(body.time, 40) ?? "Later today";
  const reason = optionalString(body.reason, 300) ?? "Not specified";
  const consultationFee = typeof body.consultationFee === "number" && body.consultationFee >= 0 ? body.consultationFee : 500;
  const patientId = requiredString(body.patientId, "patientId", 30) ?? `DEMO-${Date.now()}`;
  const current = appointments as unknown as Appointment[];
  const appointment: Appointment = {
    id: `appt-${Date.now()}`,
    patientId,
    patientName,
    channel,
    date,
    time,
    priority,
    visitType,
    reason,
    consultationFee,
    status: "Scheduled",
    queuePosition: current.filter((a) => a.date === date).length + 1,
    briefReady: false,
    briefSummary: "Pre-visit brief not yet available — intake still in progress.",
    missingInfo: optionalString(body.missingInfo, 120),
  };
  appointments.push(appointment);
  return json({ appointment }, 201);
}
