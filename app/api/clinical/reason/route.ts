import { NextResponse } from "next/server";
import {
  evaluateClinicalReasoning,
  type ClinicalReasoningRequest,
} from "@/lib/clinicalReasoningClient";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for the clinical reasoning subsystem.
 */
export async function GET() {
  const gatewayUrl =
    process.env.AI_UPCHAR_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_AI_UPCHAR_GATEWAY_URL ||
    "http://127.0.0.1:8001";

  let gatewayStatus = "OFFLINE";
  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      gatewayStatus = "ONLINE";
    }
  } catch {
    gatewayStatus = "OFFLINE";
  }

  return NextResponse.json({
    service: "AI UPCHAR Clinical Reasoning Gateway Bridge",
    gatewayUrl,
    gatewayStatus,
    safetyFloorActive: true,
    clinicalGovernance: "AI assists. Doctors decide.",
    contractKeys: [
      "semantic_interpretation",
      "recommended_action",
      "next_best_question",
      "missing_information",
      "clinical_considerations",
      "confidence",
    ],
  });
}

/**
 * Executes clinical reasoning following the Phase 4A/E3 JSON contract.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const currentAnswer = typeof body.current_answer === "string" ? body.current_answer : "";
  if (!currentAnswer.trim()) {
    return NextResponse.json(
      { error: "current_answer is required and must be a non-empty string." },
      { status: 422 }
    );
  }

  const clinicalReq: ClinicalReasoningRequest = {
    patient_context: (body.patient_context as Record<string, unknown>) || {},
    current_answer: currentAnswer,
    semantic_context: (body.semantic_context as Record<string, unknown>) || {},
    safety_state: (body.safety_state as ClinicalReasoningRequest["safety_state"]) || {
      status: "CLEAR",
    },
    retrieved_evidence: Array.isArray(body.retrieved_evidence)
      ? (body.retrieved_evidence as Array<Record<string, unknown>>)
      : [],
  };

  const reasoning = await evaluateClinicalReasoning(clinicalReq);
  return NextResponse.json(reasoning, { status: 200 });
}
