import { addReport, error, json, listReports, optionalString, patientById, readObject, type Report, requiredString, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const patientId = new URL(request.url).searchParams.get("patientId");
  const data = await listReports(patientId ?? undefined);
  return json({ reports: data, total: data.length });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const patientId = requiredString(body.patientId, "patientId", 30);
  const title = requiredString(body.title, "title", 160);
  if (!patientId || !title) return error("patientId and title are required.");
  if (!(await patientById(patientId))) return error("Patient not found.", 404);
  const type = optionalString(body.type, 30) as Report["type"] | undefined;
  if (type && !["Lab report", "Prescription", "Referral"].includes(type)) return error("type must be Lab report, Prescription, or Referral.");
  const existing = await listReports(patientId);
  const report: Report = {
    id: `report-demo-${Date.now()}-${existing.length + 1}`,
    patientId,
    title,
    type: type ?? "Lab report",
    date: new Date().toISOString().slice(0, 10),
    status: "Ready for review",
  };
  await addReport(report);
  return json({ report }, 201);
});
