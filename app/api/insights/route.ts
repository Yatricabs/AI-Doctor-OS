import { error, json, requiredString, readObject } from "../_lib/demo";

export const dynamic = "force-dynamic";

export function GET() {
  return json({
    insights: [
      { id: "insight-1", title: "Follow-up queue", detail: "Three follow-ups need review before the next clinic block.", priority: "High" },
      { id: "insight-2", title: "Report trend", detail: "Rohan Mehta's HbA1c improved while LDL remains above target.", priority: "Medium" },
      { id: "insight-3", title: "Documentation quality", detail: "Two draft notes need clinician approval before signing.", priority: "Low" },
    ],
  });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const insightId = requiredString(body.insightId, "insightId", 80);
  if (!insightId) return error("insightId is required.");
  return json({ insight: { id: insightId, status: "reviewed", reviewedAt: new Date().toISOString() } });
}
