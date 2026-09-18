import type { KnowledgeNeedAssessment, RetrievalContext } from "./types.ts";

export function assessKnowledgeNeed(context: RetrievalContext): KnowledgeNeedAssessment {
  if (context.safetyStatus === "SAFETY_CONCERN") {
    return { decision: "SAFETY_CONTEXT_RETRIEVAL", reasonCodes: ["SAFETY_CONTEXT"], confidence: "HIGH" };
  }

  const facts = context.semanticFacts;
  const problems = context.representation.problems;
  const reasonCodes: string[] = [];
  const hasPatientDiagnosis = facts.some((fact) => fact.kind === "DIAGNOSIS_CLAIM" || fact.conceptKey === "diagnosis:patient_reported");
  const hasMedicine = facts.some((fact) => fact.kind === "MEDICATION_CLAIM");
  const hasPossibleReaction = hasMedicine && facts.some((fact) => fact.kind === "SYMPTOM" || fact.kind === "TRIGGER_REFERENCE");
  const unknownProblems = problems.filter((problem) => problem.facts.every((fact) => fact.kind === "PROBLEM_REFERENCE"));
  const sufficientSingleProblemContext = problems.length === 1 && context.representation.temporalFacts.length > 0
    && context.safetyStatus === "CLEAR" && !hasPatientDiagnosis && !hasMedicine;

  if (unknownProblems.length && !sufficientSingleProblemContext) reasonCodes.push("UNUSUAL_OR_UNNORMALIZED_TERM");
  if (hasPatientDiagnosis) reasonCodes.push("PATIENT_REPORTED_DIAGNOSIS");
  if (hasPossibleReaction) reasonCodes.push("MEDICATION_ADVERSE_EFFECT_CONTEXT");
  if (problems.length > 1) reasonCodes.push("MULTIPLE_ACTIVE_PROBLEMS");
  if (context.safetyStatus === "AMBIGUOUS" || context.safetyStatus === "NEEDS_CLARIFICATION") reasonCodes.push("AMBIGUOUS_CONTEXT");

  if (reasonCodes.includes("UNUSUAL_OR_UNNORMALIZED_TERM") || reasonCodes.includes("MEDICATION_ADVERSE_EFFECT_CONTEXT")) {
    return { decision: "RETRIEVAL_REQUIRED_FOR_CONTEXT", reasonCodes, confidence: "HIGH" };
  }
  if (reasonCodes.length) return { decision: "RETRIEVAL_RECOMMENDED", reasonCodes, confidence: "MEDIUM" };
  return { decision: "NO_RETRIEVAL_NEEDED", reasonCodes: ["CONTEXT_ALREADY_SUFFICIENT"], confidence: "MEDIUM" };
}
