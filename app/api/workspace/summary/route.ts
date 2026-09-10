import { json, workspaceSummary } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ summary: workspaceSummary });
}
