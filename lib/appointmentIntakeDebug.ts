"use client";

export type IntakeDebugDetails = {
  extractedFactKinds?: string[];
  changedFactKeys?: string[];
  contradictions?: string[];
  safetyFlags?: string[];
  coveredInformation?: string[];
  candidateActions?: string[];
  selectedAction?: string;
  reasonCode?: string;
  confidence?: string;
  source?: string;
  step?: string;
};

export function recordIntakeDecision(sessionId: string, details: IntakeDebugDetails) {
  const event = { sessionId, event: "intake_turn_decision", createdAt: new Date().toISOString(), details };
  if (process.env.NODE_ENV !== "production") console.info("[intake:decision]", event);
  void fetch("/api/intake/debug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true }).catch(() => undefined);
}
