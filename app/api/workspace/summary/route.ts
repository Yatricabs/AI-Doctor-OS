import { getWorkspaceSummary, json, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async () => {
  const summary = await getWorkspaceSummary();
  return json({ summary });
});
