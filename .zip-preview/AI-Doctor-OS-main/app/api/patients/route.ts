import { Patient, error, inboxItems, json, optionalString, patients, readObject, requiredString } from "../_lib/demo";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = new URL(request.url).searchParams.get("status");
  const data = patients.filter((patient) => {
    const normalizedPhone = (patient.phone ?? "").replace(/\D/g, "");
    const normalizedQuery = query.replace(/\D/g, "");
    const matchesQuery = !query || `${patient.name} ${patient.id} ${patient.phone ?? ""}`.toLowerCase().includes(query) || (normalizedQuery.length >= 6 && normalizedPhone.endsWith(normalizedQuery));
    const matchesStatus = !status || patient.status === status;
    return matchesQuery && matchesStatus;
  });
  return json({ patients: data, total: data.length });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const name = requiredString(body.name, "name", 100);
  if (!name) return error("name is required and must be a non-empty string.");
  const appointment = optionalString(body.appointment, 160) ?? "No appointment scheduled";
  const id = requiredString(body.id, "id", 30) ?? `DEMO-${patients.length + 100}`;
  if (patients.some((patient) => patient.id === id)) return error("A patient with this id already exists.", 409);

  const normalized = name.trim().toLowerCase();
  const possibleDuplicate = patients.find((patient) => patient.name.trim().toLowerCase() === normalized);
  if (possibleDuplicate) {
    inboxItems.push({
      id: `inbox-duplicate-${Date.now()}`,
      type: "duplicate_identity",
      title: `Possible duplicate patient identity: ${name}`,
      detail: `A new registration for "${name}" was submitted with the same name as existing patient ${possibleDuplicate.id}. This was NOT auto-merged — confirm whether this is the same person before combining records.`,
      patientId: possibleDuplicate.id,
      patientName: possibleDuplicate.name,
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  const patient: Patient = { id, name, initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), appointment, status: "Waiting" };
  patients.push(patient);
  return json({ patient, possibleDuplicateOf: possibleDuplicate?.id ?? null }, 201);
}
