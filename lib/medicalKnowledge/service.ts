import { readEvidenceCache, writeEvidenceCache } from "./cache.ts";
import { buildMedicalRetrievalQuery, fingerprintRetrievalContext } from "./context.ts";
import { assessKnowledgeNeed } from "./decision.ts";
import type { EvidenceContext, MedicalKnowledgeProvider, RetrievalContext } from "./types.ts";

export type RetrievalRun = { evidence: EvidenceContext | null; decision: ReturnType<typeof assessKnowledgeNeed>; latencyMs: number; failed?: boolean };

export async function enrichClinicalContext(context: RetrievalContext, provider: MedicalKnowledgeProvider): Promise<RetrievalRun> {
  const started = Date.now();
  const decision = assessKnowledgeNeed(context);
  if (decision.decision === "NO_RETRIEVAL_NEEDED") return { evidence: null, decision, latencyMs: Date.now() - started };
  const contextKey = fingerprintRetrievalContext(context);
  const cached = readEvidenceCache(contextKey);
  if (cached) return { evidence: cached, decision, latencyMs: Date.now() - started };
  try {
    const result = await provider.retrieve({ contextKey, normalizedQuery: buildMedicalRetrievalQuery(context), context, decision });
    const evidence = { ...result, cacheHit: false };
    writeEvidenceCache(contextKey, evidence);
    return { evidence, decision, latencyMs: Date.now() - started };
  } catch {
    return { evidence: null, decision, latencyMs: Date.now() - started, failed: true };
  }
}
