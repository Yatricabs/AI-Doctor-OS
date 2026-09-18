import { error, json, patientById, readObject, reports, requiredString } from "../../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const patientId = requiredString(body.patientId, "patientId", 30);
  const reportId = requiredString(body.reportId, "reportId", 80);
  if (!patientId || !reportId) return error("patientId and reportId are required.");
  const patient = patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  const report = reports.find((item) => item.id === reportId && item.patientId === patientId);
  if (!report) return error("Report not found for this patient.", 404);

  const patientHistory = reports.filter((item) => item.patientId === patientId);
  const generated = body.generated && typeof body.generated === "object" ? (body.generated as { trend?: string; flag?: string; summary?: string }) : null;

  return json({
    analysis: {
      patientId,
      reportId: report.id,
      title: report.title,
      patient: patient.name,
      trend: generated?.trend || "HbA1c improved by 0.6% compared with the previous report.",
      flag: generated?.flag || "LDL remains above target and needs clinician review.",
      confidence: generated ? "AI-generated · illustrative, review against source" : `High · ${patientHistory.length} linked reports`,
      summary: generated?.summary || "Glycaemic control is improving. Review adherence, diet, and the current statin plan at the revisit.",
      aiGenerated: Boolean(generated),
    },
  });
}
