"use client";

import type { EvidenceContext, KnowledgeNeedAssessment, RetrievalContext } from "@/lib/medicalKnowledge/types";

export type MedicalRetrievalResult = { evidence: EvidenceContext | null; decision: KnowledgeNeedAssessment; latencyMs: number; failed?: boolean };

export async function retrieveMedicalKnowledge(context: RetrievalContext, timeoutMs = 4_000): Promise<MedicalRetrievalResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/medical-knowledge/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null) as ({ ok?: boolean } & MedicalRetrievalResult) | null;
    return response.ok && data?.ok ? data : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
