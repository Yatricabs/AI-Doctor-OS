"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useGetReportsQuery } from "@/lib/apiSlice";
import { tone } from "./shared";

const FILTERS = ["All", "Lab report", "Prescription", "Referral"] as const;

export default function ReportsView({ openPatient }: { openPatient: (patientId: string) => void }) {
  const { data, isLoading } = useGetReportsQuery();
  const reports = data?.reports ?? [];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const visible = filter === "All" ? reports : reports.filter((r) => r.type === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className="rounded-full border px-4 py-2 text-xs font-bold" style={filter === f ? { borderColor: tone.primary, background: tone.primary, color: "#fff" } : { borderColor: tone.border, color: tone.inkSoft }}>{f}</button>)}
      </div>
      {isLoading ? <p className="text-sm" style={{ color: tone.muted }}>Loading reports…</p> : visible.length === 0 ? <p className="rounded-xl border p-5 text-sm" style={{ borderColor: tone.border, background: tone.card, color: tone.muted }}>No documents in this category yet.</p> : <div className="space-y-2">
        {visible.map((report) => <button key={report.id} onClick={() => openPatient(report.patientId)} className="flex w-full items-center gap-4 rounded-xl border p-4 text-left" style={{ borderColor: tone.border, background: tone.card }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: tone.successBg, color: tone.success }}><FileText className="h-4 w-4" /></span>
          <span className="flex-1"><span className="block text-sm font-bold" style={{ color: tone.ink }}>{report.title}</span><span className="mt-0.5 block text-xs" style={{ color: tone.muted }}>{report.patientId} · {report.type} · {report.date}</span></span>
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: tone.infoBg, color: tone.info }}>{report.status}</span>
        </button>)}
      </div>}
    </div>
  );
}
