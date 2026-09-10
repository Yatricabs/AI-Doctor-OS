import { error, insights, json, requiredString, readObject } from "../_lib/demo";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ insights: insights.filter((insight) => insight.status === "open") });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const insightId = requiredString(body.insightId, "insightId", 80);
  if (!insightId) return error("insightId is required.");
  const insight = insights.find((item) => item.id === insightId);
  if (!insight) return error("Insight not found.", 404);
  insight.status = "reviewed";
  insight.reviewedAt = new Date().toISOString();
  return json({ insight });
}
