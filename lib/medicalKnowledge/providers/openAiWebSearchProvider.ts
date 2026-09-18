import { createHash } from "node:crypto";
import { classifyMedicalSource, sourceAuthority } from "../sourceHierarchy.ts";
import type { EvidenceContext, MedicalEvidenceSource, MedicalKnowledgeProvider, ProviderRetrievalRequest } from "../types.ts";

const ALLOWED_DOMAINS = [
  "who.int", "nice.org.uk", "nhs.uk", "cdc.gov", "nih.gov", "pubmed.ncbi.nlm.nih.gov",
  "mohfw.gov.in", "ncdc.mohfw.gov.in", "cdsco.gov.in", "ipc.gov.in", "cochranelibrary.com",
  "mayoclinic.org", "clevelandclinic.org", "msdmanuals.com",
];

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    action?: { sources?: Array<{ url?: string; title?: string; type?: string }> };
    content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }>;
  }>;
  error?: { message?: string };
};

function outputText(data: OpenAiResponse) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output ?? []).flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("\n").trim();
}

function actualSources(data: OpenAiResponse) {
  const collected = new Map<string, { url: string; title: string }>();
  for (const item of data.output ?? []) {
    for (const source of item.action?.sources ?? []) if (source.url) collected.set(source.url, { url: source.url, title: source.title ?? source.url });
    for (const part of item.content ?? []) for (const annotation of part.annotations ?? []) if (annotation.url) collected.set(annotation.url, { url: annotation.url, title: annotation.title ?? annotation.url });
  }
  return [...collected.values()];
}

function parseEnrichment(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    const strings = (key: string) => Array.isArray(value[key]) ? (value[key] as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 12) : [];
    return { relevantConcepts: strings("relevantConcepts"), considerations: strings("potentiallyRelevantConsiderations"), missing: strings("missingInformationSuggestedByEvidence") };
  } catch { return null; }
}

export class OpenAiWebSearchMedicalProvider implements MedicalKnowledgeProvider {
  readonly id = "openai-responses-web-search";

  async retrieve(request: ProviderRetrievalRequest): Promise<Omit<EvidenceContext, "cacheHit">> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_RETRIEVAL_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
        store: false,
        tools: [{ type: "web_search", filters: { allowed_domains: ALLOWED_DOMAINS } }],
        tool_choice: "auto",
        max_tool_calls: 2,
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: "Retrieve only reliable medical context for clinical intake. Do not diagnose, prescribe, or state that the patient has a condition. Return JSON only with relevantConcepts, potentiallyRelevantConsiderations, missingInformationSuggestedByEvidence. Every consideration must be supportable by an actually retrieved source." },
          { role: "user", content: request.normalizedQuery },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json().catch(() => null) as OpenAiResponse | null;
    if (!response.ok || !data) throw new Error(data?.error?.message || `OpenAI retrieval error ${response.status}`);
    const sources = actualSources(data);
    const enrichment = parseEnrichment(outputText(data));
    const retrievedAt = new Date().toISOString();
    if (!sources.length || !enrichment) {
      return { contextKey: request.contextKey, decision: request.decision.decision, provider: this.id, relevantConcepts: [], potentiallyRelevantConsiderations: [], missingInformationSuggestedByEvidence: [], sources: [], uncertainty: "No trustworthy, citable medical evidence was returned.", retrievedAt };
    }
    const evidenceSources: MedicalEvidenceSource[] = sources.map((item): MedicalEvidenceSource => {
      const sourceType = classifyMedicalSource(item.url);
      return { id: createHash("sha256").update(item.url).digest("hex").slice(0, 16), title: item.title, source: new URL(item.url).hostname, url: item.url, sourceType, retrievedAt, relevance: sourceAuthority(sourceType) >= 4 ? "HIGH" : "MEDIUM", summary: "Source retrieved for the accepted evidence context." };
    }).sort((a, b) => sourceAuthority(b.sourceType) - sourceAuthority(a.sourceType));
    return { contextKey: request.contextKey, decision: request.decision.decision, provider: this.id, relevantConcepts: enrichment.relevantConcepts, potentiallyRelevantConsiderations: enrichment.considerations, missingInformationSuggestedByEvidence: enrichment.missing, sources: evidenceSources, retrievedAt };
  }
}
