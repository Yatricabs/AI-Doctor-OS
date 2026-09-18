import { NextResponse } from "next/server";
import { enrichClinicalContext } from "@/lib/medicalKnowledge/service";
import { OpenAiWebSearchMedicalProvider } from "@/lib/medicalKnowledge/providers/openAiWebSearchProvider";
import type { RetrievalContext } from "@/lib/medicalKnowledge/types";

export const dynamic = "force-dynamic";

function validContext(value: unknown): value is RetrievalContext {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RetrievalContext>;
  return Boolean(item.representation && Array.isArray(item.representation.problems) && Array.isArray(item.semanticFacts)
    && item.patientContext && typeof item.patientContext === "object" && Array.isArray(item.coveredInformation)
    && ["CLEAR", "AMBIGUOUS", "NEEDS_CLARIFICATION", "SAFETY_CONCERN"].includes(String(item.safetyStatus)));
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const context = (body as { context?: unknown } | null)?.context;
  if (!validContext(context)) return NextResponse.json({ error: "A normalized retrieval context is required." }, { status: 400 });
  if (context.representation.problems.length > 12 || context.semanticFacts.length > 100) return NextResponse.json({ error: "Retrieval context is too large." }, { status: 400 });

  const run = await enrichClinicalContext(context, new OpenAiWebSearchMedicalProvider());
  console.info("[medical-retrieval]", {
    decision: run.decision.decision,
    reasonCodes: run.decision.reasonCodes,
    provider: run.evidence?.provider ?? "none",
    contextKey: run.evidence?.contextKey ?? "not-retrieved",
    resultCount: run.evidence?.sources.length ?? 0,
    sourceTypes: [...new Set(run.evidence?.sources.map((source) => source.sourceType) ?? [])],
    cacheHit: run.evidence?.cacheHit ?? false,
    failed: Boolean(run.failed),
    latencyMs: run.latencyMs,
  });
  return NextResponse.json({ ok: true, ...run });
}
