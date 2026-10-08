"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart2, CheckCircle2, Clock, FileText, MessageSquare, RefreshCw, Stethoscope, TrendingUp, Users } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

type Analytics = {
  range: string;
  date: string;
  summary: { totalPatients: number; newToday: number; totalAppointments: number; completedAppointments: number; appointmentCompletionRate: number };
  queue: { avgWaitMinutes: number };
  followUps: { pending: number; overdue: number; completedToday: number; completionRate: number };
  inbox: { open: number; urgent: number; resolvedToday: number };
  prescriptions: { today: number; signed: number; safetyAlerts: number; overridden: number; alertReviewRate: number };
  notes: { draft: number; approvedToday: number; aiAcceptanceRate: number; timeSaved: number };
  referrals: { pending: number; bySpecialty: { specialty: string; count: number }[] };
  communications: { sentToday: number; receivedToday: number };
};

const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("today");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      const payload = await res.json() as { ok: boolean; data: Analytics };
      if (payload.ok) setData(payload.data);
      else setError("Could not load analytics.");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { void load(); }, [range, load]);

  const d = data;

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-11 rounded-lg bg-[#071a32]" alt="" />
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#e4eef8] px-3 py-1 text-xs font-bold text-[#3a5a8a]">Admin</span>
            <Link href="/doctor/morning-brief" className="text-xs text-[#5a967e] hover:underline">Doctor view →</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">Clinic Analytics</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">Governance & Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#dce9e3] bg-white overflow-hidden">
              {RANGES.map((r) => (
                <button key={r.value} onClick={() => setRange(r.value)} className={`px-3 py-1.5 text-xs font-semibold transition ${range === r.value ? "bg-[#07947f] text-white" : "text-[#54716d] hover:bg-[#f0f6f3]"}`}>{r.label}</button>
              ))}
            </div>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-[#dce9e3] p-1.5 text-[#54716d]">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        {loading && !d && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading analytics…</p>}

        {d && (
          <>
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
              <MetricCard icon={Users} label="Total patients" value={String(d.summary.totalPatients)} sub={`${d.summary.newToday} new today`} color="text-[#07947f]" bg="bg-[#edf7f2]" />
              <MetricCard icon={Activity} label="Appointments" value={String(d.summary.totalAppointments)} sub={`${d.summary.appointmentCompletionRate}% completed`} color="text-[#6682a5]" bg="bg-[#edf2f8]" />
              <MetricCard icon={Clock} label="Avg wait time" value={`${d.queue.avgWaitMinutes}m`} sub="Queue average" color="text-[#b07d4a]" bg="bg-[#f6f0e9]" />
              <MetricCard icon={TrendingUp} label="AI acceptance" value={`${Math.round(d.notes.aiAcceptanceRate * 100)}%`} sub="Notes accepted" color="text-[#9773a4]" bg="bg-[#f4eef7]" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Follow-ups */}
              <AnalyticsCard title="Follow-ups" icon={CheckCircle2} color="text-[#07947f]">
                <StatRow label="Pending" value={d.followUps.pending} />
                <StatRow label="Overdue" value={d.followUps.overdue} highlight={d.followUps.overdue > 0} />
                <StatRow label="Completed today" value={d.followUps.completedToday} />
                <ProgressBar label="Completion rate" value={d.followUps.completionRate} />
              </AnalyticsCard>

              {/* AI Inbox */}
              <AnalyticsCard title="AI Inbox" icon={Activity} color="text-[#6682a5]">
                <StatRow label="Open items" value={d.inbox.open} />
                <StatRow label="Urgent" value={d.inbox.urgent} highlight={d.inbox.urgent > 0} />
                <StatRow label="Resolved today" value={d.inbox.resolvedToday} />
              </AnalyticsCard>

              {/* Prescriptions & Safety */}
              <AnalyticsCard title="Prescriptions & Safety" icon={AlertTriangle} color="text-[#c0503e]">
                <StatRow label="Prescriptions today" value={d.prescriptions.today} />
                <StatRow label="Signed" value={d.prescriptions.signed} />
                <StatRow label="Safety alerts fired" value={d.prescriptions.safetyAlerts} />
                <StatRow label="Overridden" value={d.prescriptions.overridden} highlight={d.prescriptions.overridden > 0} />
                <ProgressBar label="Alert review rate" value={d.prescriptions.alertReviewRate} />
              </AnalyticsCard>

              {/* Notes & AI */}
              <AnalyticsCard title="Clinical Notes & AI" icon={FileText} color="text-[#9773a4]">
                <StatRow label="Draft notes" value={d.notes.draft} highlight={d.notes.draft > 0} />
                <StatRow label="Approved today" value={d.notes.approvedToday} />
                <StatRow label="Time saved" value={`${Math.floor(d.notes.timeSaved / 60)}h ${d.notes.timeSaved % 60}m`} />
                <ProgressBar label="AI acceptance" value={Math.round(d.notes.aiAcceptanceRate * 100)} />
              </AnalyticsCard>

              {/* Referrals */}
              <AnalyticsCard title="Referrals" icon={BarChart2} color="text-[#b07d4a]">
                <StatRow label="Pending referrals" value={d.referrals.pending} />
                <div className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#78908a] mb-1">By specialty</p>
                  {d.referrals.bySpecialty.map((r) => (
                    <div key={r.specialty} className="flex justify-between text-xs py-0.5">
                      <span className="text-[#5f7c70]">{r.specialty}</span>
                      <span className="font-bold text-[#244642]">{r.count}</span>
                    </div>
                  ))}
                </div>
              </AnalyticsCard>

              {/* Communications */}
              <AnalyticsCard title="Communications" icon={MessageSquare} color="text-[#6682a5]">
                <StatRow label="Messages sent today" value={d.communications.sentToday} />
                <StatRow label="Patient messages received" value={d.communications.receivedToday} />
                <p className="mt-3 text-[11px] text-[#78908a]">All outbound messages require doctor approval before dispatch.</p>
              </AnalyticsCard>
            </div>

            {/* Safety Notice */}
            <div className="mt-5 rounded-xl border border-[#c2ddd5] bg-[#edf7f2] p-4 text-sm text-[#1f6a4a]">
              <p className="font-bold">Clinical safety note</p>
              <p className="mt-1 text-xs text-[#317b67]">All AI outputs are assistive only. Every prescription requires explicit doctor sign-off. Safety alerts must be reviewed or overridden with documented clinical reason. Audit trail is maintained for all clinical actions.</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color, bg }: { icon: React.ElementType; label: string; value: string; sub: string; color: string; bg: string }) {
  return (
    <div className="rounded-xl border border-[#e1e9e5] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#78908a]">{label}</p>
        <div className={`rounded-lg p-1.5 ${bg}`}><Icon className={`h-4 w-4 ${color}`} /></div>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#173f3c]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#8a9e98]">{sub}</p>
    </div>
  );
}

function AnalyticsCard({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
      <h3 className={`flex items-center gap-2 text-sm font-bold text-[#244642] mb-3`}><Icon className={`h-4 w-4 ${color}`} />{title}</h3>
      {children}
    </div>
  );
}

function StatRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#f0f4f2] last:border-0">
      <span className="text-xs text-[#5f7c70]">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-red-500" : "text-[#173f3c]"}`}>{value}</span>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[#78908a]">{label}</span>
        <span className="font-bold text-[#244642]">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#e1e9e5]">
        <div className="h-1.5 rounded-full bg-[#07947f] transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}
