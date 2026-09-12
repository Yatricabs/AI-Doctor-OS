"use client";

import { useEffect, useState } from "react";
import { CalendarDays, IndianRupee, Loader2, Users, Clock3, ArrowUpRight } from "lucide-react";
import { apiGet } from "./api";
import { formatINR, humanize } from "@/lib/format";

type Appt = { id: string; patientId: string; patientName?: string; visitType: string; appointmentTime: string; appointmentDate: string; status: string; reason?: string };
type QueueEntry = { id: string; patientName?: string; tokenNumber?: string; status: string; priority: string };
type FollowUp = { id: string; title: string; dueDate: string; priority: string; patientId: string };
type RevenueSummary = { today: { total: number; bills: number }; allTime: { total: number; bills: number }; breakdown: Record<string, number> };

const FOLLOWUP_TYPES = new Set(["follow_up", "report_review", "wellness"]);

export default function DashboardScreen({ onGoto }: { onGoto: (nav: string, patientId?: string) => void }) {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [queue, setQueue] = useState<{ entries: QueueEntry[]; waiting: number; urgent: number } | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [a, q, rev] = await Promise.all([
          apiGet<{ appointments: Appt[] }>(`/api/appointments?date=${today}`).catch(() => ({ appointments: [] as Appt[] })),
          apiGet<{ queue: { entries: QueueEntry[]; waiting: number; urgent: number } }>("/api/queue").catch(() => ({ queue: { entries: [], waiting: 0, urgent: 0 } })),
          apiGet<RevenueSummary>("/api/billing?summary=1").catch(() => null),
        ]);
        // Follow-ups due (best effort).
        const fu = await apiGet<{ followUps?: FollowUp[]; overdueFollowUps?: FollowUp[] }>("/api/follow-ups")
          .catch((): { followUps?: FollowUp[]; overdueFollowUps?: FollowUp[] } => ({}));
        if (cancelled) return;
        setAppts(a.appointments);
        setQueue(q.queue);
        setRevenue(rev);
        setFollowUps(fu.followUps ?? fu.overdueFollowUps ?? []);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load dashboard."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = appts.length;
  const followCount = appts.filter((a) => FOLLOWUP_TYPES.has(a.visitType)).length;
  const newCount = total - followCount;

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78908a]">Live clinic · {today}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#173f3c]">Dashboard</h1>
        </div>
        <button onClick={() => onGoto("Appointments")} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#066d66]">
          <CalendarDays className="h-4 w-4" /> Appointments
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Appointments today" value={String(total).padStart(2, "0")} detail={`${newCount} new · ${followCount} follow-up`} icon={CalendarDays} tone="bg-[#eef7f2] text-[#4f9d78]" onClick={() => onGoto("Appointments")} />
            <StatCard label="In queue" value={String(queue?.waiting ?? 0).padStart(2, "0")} detail={`${queue?.urgent ?? 0} urgent`} icon={Users} tone="bg-[#edf2f8] text-[#6682a5]" />
            <StatCard label="Today's revenue" value={formatINR(revenue?.today.total ?? 0)} detail={`${revenue?.today.bills ?? 0} bill(s)`} icon={IndianRupee} tone="bg-[#f6f0e9] text-[#bd865b]" onClick={() => onGoto("Billing")} />
            <StatCard label="Total earnings" value={formatINR(revenue?.allTime.total ?? 0)} detail="All-time" icon={IndianRupee} tone="bg-[#f4eef7] text-[#9773a4]" onClick={() => onGoto("Billing")} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Today's schedule */}
            <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#5a967e]">Today&apos;s schedule</h2>
                <button onClick={() => onGoto("Appointments")} className="flex items-center gap-1 text-xs font-semibold text-[#56896d] hover:underline">View all <ArrowUpRight className="h-3 w-3" /></button>
              </div>
              <div className="mt-3 space-y-2">
                {appts.slice(0, 6).map((a) => (
                  <button key={a.id} onClick={() => onGoto("Patients", a.patientId)} className="flex w-full items-center gap-3 rounded-lg border border-[#eef4f1] px-3 py-2 text-left hover:bg-[#f7faf8]">
                    <Clock3 className="h-4 w-4 shrink-0 text-[#9db3aa]" />
                    <span className="w-14 shrink-0 text-xs font-semibold text-[#5f7c70]">{a.appointmentTime}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#24443f]">{a.patientName ?? a.patientId}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${FOLLOWUP_TYPES.has(a.visitType) ? "bg-[#f4eef7] text-[#9773a4]" : "bg-[#edf2f8] text-[#6682a5]"}`}>{FOLLOWUP_TYPES.has(a.visitType) ? "Follow-up" : "New"}</span>
                  </button>
                ))}
                {appts.length === 0 && <p className="py-6 text-center text-sm text-[#9db3aa]">No appointments today.</p>}
              </div>
            </div>

            {/* Revenue breakdown + follow-ups */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#5a967e]">Revenue breakdown</h2>
                <div className="mt-3 space-y-2">
                  {[["appointment", "Consultation"], ["medicine", "Medicines"], ["test", "Tests"], ["scan", "Scans"]].map(([k, label]) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="text-[#5f7c70]">{label}</span>
                      <span className="font-semibold text-[#24443f]">{formatINR(revenue?.breakdown[k] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#5a967e]">Follow-ups due</h2>
                <div className="mt-3 space-y-2">
                  {followUps.slice(0, 4).map((f) => (
                    <button key={f.id} onClick={() => onGoto("Patients", f.patientId)} className="flex w-full items-center justify-between rounded-lg border border-[#eef4f1] px-3 py-2 text-left hover:bg-[#f7faf8]">
                      <span className="min-w-0 truncate text-sm text-[#24443f]">{f.title}</span>
                      <span className="shrink-0 text-[11px] text-[#8a9e98]">{f.dueDate}</span>
                    </button>
                  ))}
                  {followUps.length === 0 && <p className="py-4 text-center text-sm text-[#9db3aa]">No follow-ups due.</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone, onClick }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; tone: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="rounded-2xl border border-[#e1e9e5] bg-white p-4 text-left disabled:cursor-default enabled:hover:border-[#c2ddd5]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-[#6d827c]">{label}</p>
        <span className={`rounded-lg p-1.5 ${tone}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#173f3c]">{value}</p>
      <p className="mt-1 text-[11px] text-[#77908a]">{detail}</p>
    </button>
  );
}
