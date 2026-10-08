"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Inbox, LayoutDashboard, ListTodo, RefreshCw, Stethoscope, Users, UserCheck, Phone } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

type QueueEntry = {
  id: string;
  patientId: string;
  patientName?: string;
  patientInitials?: string;
  tokenNumber?: string;
  priority: string;
  status: string;
  checkedInAt?: string;
  estimatedWaitMinutes?: number;
  position?: number;
  isWalkIn: number;
  priorityReason?: string;
};

const priorityColor: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  routine: "bg-[#edf7f2] text-[#4e927d] border-[#c2ddd5]",
  follow_up: "bg-blue-50 text-blue-600 border-blue-100",
  administrative: "bg-gray-100 text-gray-600 border-gray-200",
};

const statusColor: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-700",
  called: "bg-blue-100 text-blue-700",
  in_consultation: "bg-[#07947f] text-white",
  completed: "bg-gray-100 text-gray-500",
};

export default function QueuePage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState({ waiting: 0, urgent: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/queue?clinicId=clinic-001");
      const payload = await res.json() as { ok: boolean; data: { queue: { entries: QueueEntry[]; waiting: number; urgent: number; total: number } } };
      if (payload.ok) {
        setEntries(payload.data.queue.entries);
        setStats({ waiting: payload.data.queue.waiting, urgent: payload.data.queue.urgent, total: payload.data.queue.total });
      }
    } catch { setError("Could not load queue."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  async function queueAction(action: string, entryId: string) {
    setActionLoading(entryId);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entryId }),
      });
      const payload = await res.json() as { ok: boolean };
      if (payload.ok) await load();
    } catch { setError("Action failed."); }
    finally { setActionLoading(""); }
  }

  async function callNext() {
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "call_next" }),
      });
      const payload = await res.json() as { ok: boolean; data: { message: string } };
      if (payload.ok) { await load(); }
    } catch { setError("Could not call next patient."); }
  }

  const waiting = entries.filter((e) => e.status === "waiting");
  const inConsultation = entries.filter((e) => e.status === "in_consultation" || e.status === "called");

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[78px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[260px] md:px-6 md:py-8">
        <Link href="/demo" className="flex items-center gap-3 px-2">
          <BrandLogo className="h-10 w-14 rounded-xl bg-[#071a32]" alt="" />
          <span className="hidden text-[20px] font-bold tracking-[-0.05em] text-[#193d3a] md:inline">AI UPCHAR</span>
        </Link>
        <nav className="mt-8 space-y-1">
          {[
            { label: "Morning Brief", icon: LayoutDashboard, href: "/doctor/morning-brief" },
            { label: "Queue", icon: Users, href: "/doctor/queue", active: true },
            { label: "AI Inbox", icon: Inbox, href: "/doctor/inbox" },
            { label: "Follow-ups", icon: ListTodo, href: "/doctor/follow-ups" },
            { label: "Workspace", icon: Stethoscope, href: "/demo" },
          ].map(({ label, icon: Icon, href, active }) => (
            <Link key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-[#153f3c] text-white" : "text-[#6c8782] hover:bg-white/70 hover:text-[#315d57]"}`}>
              <Icon className="h-4 w-4 shrink-0" /><span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="ml-[78px] md:ml-[260px]">
        <header className="sticky top-0 z-30 border-b border-[#e4ebe7] bg-[#fbfdfc] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">Live Queue</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">Patient Queue</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void callNext()} className="flex items-center gap-2 rounded-lg bg-[#07947f] px-4 py-2 text-xs font-bold text-white hover:bg-[#067a68]">
                <Phone className="h-3.5 w-3.5" /> Call Next
              </button>
              <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[#dce9e3] px-3 py-2 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3]">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-6 md:px-8">
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-[#e1e9e5] bg-white p-4 text-center">
              <p className="text-2xl font-bold text-[#173f3c]">{stats.total}</p>
              <p className="text-xs text-[#78908a] mt-1">Total in queue</p>
            </div>
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">{stats.waiting}</p>
              <p className="text-xs text-yellow-600 mt-1">Waiting</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
              <p className="text-xs text-red-500 mt-1">Urgent</p>
            </div>
          </div>

          {/* In Consultation */}
          {inConsultation.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#07947f]">In Consultation</h2>
              {inConsultation.map((entry) => (
                <div key={entry.id} className="mb-2 flex items-center gap-4 rounded-xl border-2 border-[#07947f] bg-[#edf7f2] p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#07947f] text-sm font-bold text-white">{entry.patientInitials ?? "??"}</div>
                  <div className="flex-1">
                    <p className="font-bold text-[#173f3c]">{entry.patientName ?? entry.patientId}</p>
                    <p className="text-xs text-[#5a967e]">Token: {entry.tokenNumber} · {entry.priority} priority</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void queueAction("complete", entry.id)} disabled={actionLoading === entry.id} className="rounded-lg bg-[#07947f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Waiting Queue */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#78908a]">Waiting ({waiting.length})</h2>
            {loading && waiting.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading queue…</p>}
            {!loading && waiting.length === 0 && <p className="rounded-xl border border-dashed border-[#c2ddd5] p-8 text-center text-sm text-[#78908a]">Queue is empty.</p>}
            <div className="space-y-2">
              {waiting.map((entry) => (
                <div key={entry.id} className={`flex items-center gap-4 rounded-xl border p-4 bg-white ${priorityColor[entry.priority] ?? "border-[#e1e9e5]"}`}>
                  {entry.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4f3ed] text-sm font-bold text-[#4e927d] shrink-0">{entry.patientInitials ?? "??"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#173f3c]">{entry.patientName ?? entry.patientId}</p>
                      {entry.isWalkIn === 1 && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-600">WALK-IN</span>}
                    </div>
                    <p className="text-xs text-[#78908a]">Token: {entry.tokenNumber} · Wait: ~{entry.estimatedWaitMinutes ?? "?"} min · Position {entry.position}</p>
                    {entry.priorityReason && <p className="text-xs font-medium text-red-600 mt-0.5">{entry.priorityReason}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityColor[entry.priority]}`}>{entry.priority}</span>
                    <button onClick={() => void queueAction("start_consultation", entry.id)} disabled={actionLoading === entry.id} className="rounded-lg bg-[#124b47] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5" /> Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick nav */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/reception/checkin" className="flex items-center gap-2 rounded-lg border border-[#dce9e3] px-4 py-2 text-sm font-semibold text-[#54716d] hover:bg-[#f0f6f3]">
              <UserCheck className="h-4 w-4" /> Check-in Patient
            </Link>
            <Link href="/doctor/morning-brief" className="flex items-center gap-2 rounded-lg border border-[#dce9e3] px-4 py-2 text-sm font-semibold text-[#54716d] hover:bg-[#f0f6f3]">
              <LayoutDashboard className="h-4 w-4" /> Morning Brief
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
