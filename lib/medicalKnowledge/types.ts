import type { ClinicalContextRepresentation, SemanticFact } from "../appointmentContextConsistency.ts";

export type RetrievalDecision =
  | "NO_RETRIEVAL_NEEDED"
  | "RETRIEVAL_RECOMMENDED"
  | "RETRIEVAL_REQUIRED_FOR_CONTEXT"
  | "SAFETY_CONTEXT_RETRIEVAL";

export type MedicalSourceType = "GUIDELINE" | "GOVERNMENT" | "ACADEMIC" | "INSTITUTIONAL" | "CURATED" | "WEB";

export type MedicalEvidenceSource = {
  id: string;
  title: string;
  source: string;
  url: string;
  sourceType: MedicalSourceType;
  publishedAt?: string;
  retrievedAt: string;
  relevance: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
};

export type EvidenceContext = {
  contextKey: string;
  decision: RetrievalDecision;
  provider: string;
  relevantConcepts: string[];
  potentiallyRelevantConsiderations: string[];
  missingInformationSuggestedByEvidence: string[];
  sources: MedicalEvidenceSource[];
  uncertainty?: string;
  retrievedAt: string;
  cacheHit: boolean;
};

export type RetrievalContext = {
  representation: ClinicalContextRepresentation;
  semanticFacts: SemanticFact[];
  patientContext: { sex?: string; ageGroup?: string };
  safetyStatus: "CLEAR" | "AMBIGUOUS" | "NEEDS_CLARIFICATION" | "SAFETY_CONCERN";
  coveredInformation: string[];
};

export type KnowledgeNeedAssessment = {
  decision: RetrievalDecision;
  reasonCodes: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type ProviderRetrievalRequest = {
  contextKey: string;
  normalizedQuery: string;
  context: RetrievalContext;
  decision: KnowledgeNeedAssessment;
};

export interface MedicalKnowledgeProvider {
  readonly id: string;
  retrieve(request: ProviderRetrievalRequest): Promise<Omit<EvidenceContext, "cacheHit">>;
}
