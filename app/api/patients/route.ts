import { error, json, listPatients, addPatient, patientById, optionalString, type Patient, readObject, requiredString, safeRoute } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = new URL(request.url).searchParams.get("status");
  const all = await listPatients();
  const data = all.filter((patient) => {
    const matchesQuery = !query || `${patient.name} ${patient.id}`.toLowerCase().includes(query);
    const matchesStatus = !status || patient.status === status;
    return matchesQuery && matchesStatus;
  });
  return json({ patients: data, total: data.length });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const name = requiredString(body.name, "name", 100);
  if (!name) return error("name is required and must be a non-empty string.");
  const appointment = optionalString(body.appointment, 160) ?? "No appointment scheduled";
  const all = await listPatients();
  const id = requiredString(body.id, "id", 30) ?? `DEMO-${all.length + 100}`;
  if (await patientById(id)) return error("A patient with this id already exists.", 409);
  const patient: Patient = {
    id,
    name,
    initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    appointment,
    status: "Waiting",
  };
  await addPatient(patient);
  return json({ patient }, 201);
});
