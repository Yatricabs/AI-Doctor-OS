import { createHash } from "node:crypto";
import type { RetrievalContext } from "./types.ts";

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim().toLowerCase()))].sort();
}

export function normalizedRetrievalTerms(context: RetrievalContext): string[] {
  return unique([
    ...context.representation.problems.map((problem) => problem.statement),
    ...context.semanticFacts.map((fact) => fact.normalizedConcept ?? fact.conceptKey ?? fact.value),
    ...context.representation.temporalFacts.map((fact) => fact.value),
    context.patientContext.sex ? `sex:${context.patientContext.sex}` : undefined,
    context.patientContext.ageGroup ? `age-group:${context.patientContext.ageGroup}` : undefined,
  ]).slice(0, 40);
}

export function fingerprintRetrievalContext(context: RetrievalContext): string {
  return createHash("sha256").update(JSON.stringify({
    terms: normalizedRetrievalTerms(context),
    safetyStatus: context.safetyStatus,
    covered: [...context.coveredInformation].sort(),
  })).digest("hex").slice(0, 24);
}

export function buildMedicalRetrievalQuery(context: RetrievalContext): string {
  const terms = normalizedRetrievalTerms(context).filter((term) => !term.startsWith("sex:") && !term.startsWith("age-group:"));
  return `Clinical intake evidence for: ${terms.join("; ")}. Identify useful missing history, red-flag considerations, and official guidance context. Do not diagnose or prescribe.`;
}
