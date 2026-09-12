import { error, insightById, json, listInsights, nowIso, persistInsight, requiredString, readObject, safeRoute } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async () => {
  const insights = await listInsights(true);
  return json({ insights });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const insightId = requiredString(body.insightId, "insightId", 80);
  if (!insightId) return error("insightId is required.");
  const insight = await insightById(insightId);
  if (!insight) return error("Insight not found.", 404);
  const reviewedAt = nowIso();
  await persistInsight(insightId, { status: "reviewed", reviewedAt });
  return json({ insight: { ...insight, status: "reviewed", reviewedAt } });
});
