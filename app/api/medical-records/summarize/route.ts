import { error, json, readObject, reportById, requiredString, safeRoute } from "../../_lib/demo";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const reportId = requiredString(body.reportId, "reportId", 80);
  const title = requiredString(body.title, "title", 160);
  if (!reportId || !title) return error("reportId and title are required.");
  const report = await reportById(reportId);
  if (!report) return error("Report not found.", 404);
  return json({
    summary: {
      reportId,
      title: report.title,
      keyFindings: ["HbA1c trend is improving", "LDL remains above target", "No urgent red flags detected in the demo report"],
      nextStep: "Review adherence, diet, and the current treatment plan with the patient.",
      disclaimer: "Demo summary only; confirm against the original document.",
    },
  });
});
