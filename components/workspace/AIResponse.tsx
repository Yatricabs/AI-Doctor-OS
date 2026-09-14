"use client";

import { Sparkles } from "lucide-react";
import ClinicalReportRenderer from "../clinical-report-renderer/ClinicalReportRenderer";
import { parseClinicalReport } from "@/lib/clinical-report-renderer";

/** Human-facing AI report boundary. The host owns fetching/streaming; the reusable
 * renderer receives only source text and explicit presentation metadata. */
export default function AIResponse({ text, streaming = false, tone = "clinical" }: { text: string; streaming?: boolean; tone?: "clinical" | "copilot" }) {
  const ir = parseClinicalReport({ source: text });
  if (!text.trim()) return null;
  return (
    <div className={`mt-4 rounded-xl border ${tone === "copilot" ? "border-[#dfe3f5]" : "border-[#dfeee7]"} bg-white`}>
      <div className="flex items-center gap-2 border-b border-[#eef4f1] px-4 py-2.5">
        <Sparkles className={`h-3.5 w-3.5 ${tone === "copilot" ? "text-[#5a6bb0]" : "text-[#2f8f74]"}`} aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#2f8f74]">AI response</span>
        <span className="ml-auto rounded-full bg-[#f0f6f3] px-2 py-0.5 text-[10px] font-semibold text-[#7f9b90]">Review required</span>
      </div>
      <div className="px-4 py-4"><ClinicalReportRenderer ir={ir} /></div>
      {streaming && <span className="mx-4 mb-3 inline-block h-4 w-[2px] animate-pulse bg-[#9db3aa] align-middle" aria-label="Response streaming" />}
      <p className="border-t border-[#eef4f1] px-4 py-2 text-[10px] leading-4 text-[#9aaba3]">AI-generated · not a diagnosis · the clinician makes the final decision.</p>
    </div>
  );
}
