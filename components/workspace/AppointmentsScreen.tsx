"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";
import { apiGet } from "./api";
import { humanize } from "@/lib/format";

type Appt = {
  id: string; patientId: string; patientName?: string; patientInitials?: string; patientPhone?: string;
  visitType: string; appointmentDate: string; appointmentTime: string; status: string; reason?: string;
};

const FOLLOWUP_TYPES = new Set(["follow_up", "report_review", "wellness"]);
function isFollowUp(v: string) { return FOLLOWUP_TYPES.has(v); }

const FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "follow", label: "Follow-up" },
] as const;

export default function AppointmentsScreen({ onOpenPatient }: { onOpenPatient?: (id: string) => void }) {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "follow">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setAppts((await apiGet<{ appointments: Appt[] }>("/api/appointments")).appointments); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load appointments."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const total = appts.length;
  const newCount = appts.filter((a) => !isFollowUp(a.visitType)).length;
  const followCount = appts.filter((a) => isFollowUp(a.visitType)).length;
  const visible = appts.filter((a) => filter === "all" || (filter === "follow" ? isFollowUp(a.visitType) : !isFollowUp(a.visitType)));

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Appointments</h1>
          <p className="mt-1 text-sm text-[#78908a]">Schedule and manage new and follow-up appointments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/patient/ai-intake" target="_blank" className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#066d66]">
            <Sparkles className="h-4 w-4" /> New / follow-up appointment
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Total" value={total} tone="bg-[#eef7f2] text-[#4f9d78]" />
        <Stat label="New" value={newCount} tone="bg-[#edf2f8] text-[#6682a5]" />
        <Stat label="Follow-up" value={followCount} tone="bg-[#f4eef7] text-[#9773a4]" />
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === f.key ? "bg-[#153f3c] text-white" : "border border-[#dce9e3] text-[#5a7a6e] hover:bg-[#f0f6f3]"}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="mt-5 space-y-2">
          {visible.map((a) => (
            <button key={a.id} onClick={() => onOpenPatient?.(a.patientId)} className="flex w-full items-center gap-3 rounded-xl border border-[#e1e9e5] bg-white px-4 py-3 text-left hover:border-[#c2ddd5] hover:bg-[#f7faf8]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d5eee4] text-xs font-bold text-[#277a6b]">{a.patientInitials ?? a.patientName?.slice(0, 2).toUpperCase() ?? "?"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#24443f]">{a.patientName ?? a.patientId}</p>
                <p className="text-[11px] text-[#8a9e98]">{a.reason ?? humanize(a.visitType)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#24443f]">{a.appointmentTime}</p>
                <p className="text-[11px] text-[#8a9e98]">{a.appointmentDate}</p>
              </div>
              <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isFollowUp(a.visitType) ? "bg-[#f4eef7] text-[#9773a4]" : "bg-[#edf2f8] text-[#6682a5]"}`}>{isFollowUp(a.visitType) ? "Follow-up" : "New"}</span>
            </button>
          ))}
          {visible.length === 0 && <p className="rounded-xl border border-[#e1e9e5] bg-white px-4 py-10 text-center text-sm text-[#8a9e98]"><CalendarDays className="mx-auto mb-2 h-6 w-6 text-[#c2ddd5]" />No appointments.</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e9e5] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#6d827c]">{label}</p>
        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${tone}`}>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#173f3c]">{String(value).padStart(2, "0")}</p>
    </div>
  );
}
