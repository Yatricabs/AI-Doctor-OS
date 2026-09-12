import { error, json, listReports, patientById, readObject, requiredString, safeRoute } from "../../_lib/demo";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const patientId = requiredString(body.patientId, "patientId", 30);
  const reportId = requiredString(body.reportId, "reportId", 80);
  if (!patientId || !reportId) return error("patientId and reportId are required.");
  const patient = await patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  const reports = await listReports(patientId);
  const report = reports.find((item) => item.id === reportId);
  if (!report) return error("Report not found for this patient.", 404);
  return json({
    analysis: {
      patientId,
      reportId: report.id,
      title: report.title,
      patient: patient.name,
      trend: "HbA1c improved by 0.6% compared with the previous report.",
      flag: "LDL remains above target and needs clinician review.",
      confidence: "High · 2 linked reports",
      summary: "Glycaemic control is improving. Review adherence, diet, and the current statin plan at the revisit.",
    },
  });
});
