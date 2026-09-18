import { error, json, readObject, reports, requiredString } from "../../_lib/demo";

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const reportId = requiredString(body.reportId, "reportId", 80);
  const title = requiredString(body.title, "title", 160);
  if (!reportId || !title) return error("reportId and title are required.");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return error("Report not found.", 404);

  const generated = body.generated && typeof body.generated === "object" ? (body.generated as { keyFindings?: string[]; nextStep?: string }) : null;

  return json({
    summary: {
      reportId,
      title: report.title,
      keyFindings: generated?.keyFindings?.length ? generated.keyFindings : ["HbA1c trend is improving", "LDL remains above target", "No urgent red flags detected in the demo report"],
      nextStep: generated?.nextStep || "Review adherence, diet, and the current treatment plan with the patient.",
      aiGenerated: Boolean(generated),
      disclaimer: "Illustrative summary — this demo has no underlying document text; confirm against the original report.",
    },
  });
}
