"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Calendar, CheckCircle2, Clock, Inbox, LayoutDashboard, ListTodo, Plus, RefreshCw, Stethoscope, Users, X, AlertTriangle } from "lucide-react";

type FollowUp = {
  id: string;
  patientId: string;
  patientName?: string;
  patientInitials?: string;
  title: string;
  description?: string;
  dueDate: string;
  status: string;
  priority: string;
  completedAt?: string;
};

const priorityColor: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-amber-400",
  medium: "border-l-4 border-l-blue-400",
  routine: "border-l-4 border-l-gray-300",
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [stats, setStats] = useState({ total: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [form, setForm] = useState({ patientId: "", title: "", description: "", dueDate: "", priority: "routine" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overdue = filterStatus === "overdue";
      const url = overdue
        ? "/api/follow-ups?overdue=true"
        : `/api/follow-ups?status=${filterStatus}`;
      const res = await fetch(url);
      const payload = await res.json() as { ok: boolean; data: { followUps: FollowUp[]; total: number; overdueCount: number } };
      if (payload.ok) {
        setFollowUps(payload.data.followUps);
        setStats({ total: payload.data.total, overdueCount: payload.data.overdueCount });
      }
    } catch { setError("Could not load follow-ups."); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { void load(); }, [load]);

  async function complete(followUpId: string) {
    setActionLoading(followUpId);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", followUpId }),
      });
      const payload = await res.json() as { ok: boolean };
      if (payload.ok) { setNotice("Follow-up completed."); await load(); }
    } catch { setError("Could not complete follow-up."); }
    finally { setActionLoading(""); }
  }

  async function addFollowUp() {
    if (!form.patientId || !form.title || !form.dueDate) { setError("Patient ID, title and due date are required."); return; }
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form }),
      });
      const payload = await res.json() as { ok: boolean };
      if (payload.ok) {
        setNotice("Follow-up created.");
        setShowAdd(false);
        setForm({ patientId: "", title: "", description: "", dueDate: "", priority: "routine" });
        await load();
      }
    } catch { setError("Could not create follow-up."); }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[78px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[260px] md:px-6 md:py-8">
        <Link href="/demo" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#078d79] text-white"><Stethoscope className="h-5 w-5" /></span>
          <span className="hidden text-[20px] font-bold tracking-[-0.05em] text-[#193d3a] md:inline">AI UPCHAR</span>
        </Link>
        <nav className="mt-8 space-y-1">
          {[
            { label: "Morning Brief", icon: LayoutDashboard, href: "/doctor/morning-brief" },
            { label: "Queue", icon: Users, href: "/doctor/queue" },
            { label: "AI Inbox", icon: Inbox, href: "/doctor/inbox" },
            { label: "Follow-ups", icon: ListTodo, href: "/doctor/follow-ups", active: true },
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">Care Continuity</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">Follow-ups</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-[#07947f] px-4 py-2 text-xs font-bold text-white">
                <Plus className="h-3.5 w-3.5" /> Add Follow-up
              </button>
              <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-[#dce9e3] p-2 text-[#54716d] hover:bg-[#f0f6f3]">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-6 md:px-8">
          {notice && <div className="mb-4 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-3 text-sm text-[#317b67]">{notice}</div>}
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {/* Add Follow-up Modal */}
          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173f3c]/30 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#244642]">Add Follow-up</h2>
                  <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-[#78908a]" /></button>
                </div>
                <div className="space-y-3">
                  <input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} placeholder="Patient ID (e.g. RM-102) *" className="w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]" />
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow-up title *" className="w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]" />
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f] h-20" />
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} min={today} className="w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]" />
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]">
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="routine">Routine</option>
                  </select>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#6b827a]">Cancel</button>
                  <button onClick={() => void addFollowUp()} className="rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white">Save Follow-up</button>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl border border-[#e1e9e5] bg-white p-4 text-center">
              <p className="text-2xl font-bold text-[#173f3c]">{stats.total}</p>
              <p className="text-xs text-[#78908a] mt-1">Total pending</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.overdueCount}</p>
              <p className="text-xs text-amber-500 mt-1">Overdue</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mb-5 flex gap-2 flex-wrap">
            {[
              { value: "pending", label: "Pending" },
              { value: "overdue", label: "Overdue" },
              { value: "completed", label: "Completed" },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setFilterStatus(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filterStatus === value ? "bg-[#124b47] text-white" : "border border-[#dce9e3] bg-white text-[#54716d] hover:bg-[#f0f6f3]"}`}>
                {label}
              </button>
            ))}
          </div>

          {loading && followUps.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading follow-ups…</p>}
          {!loading && followUps.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#c2ddd5] p-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#5a9b6a]" />
              <p className="text-sm font-semibold text-[#317b67]">No follow-ups in this view.</p>
            </div>
          )}

          <div className="space-y-2">
            {followUps.map((fu) => {
              const isOverdue = fu.status === "pending" && fu.dueDate < today;
              return (
                <div key={fu.id} className={`rounded-xl border border-[#e1e9e5] bg-white p-4 ${priorityColor[fu.priority] ?? ""}`}>
                  <div className="flex items-start gap-3">
                    <Calendar className={`mt-0.5 h-5 w-5 shrink-0 ${isOverdue ? "text-red-500" : "text-[#5a967e]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#173f3c]">{fu.title}</p>
                        {isOverdue && <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600"><AlertTriangle className="h-3 w-3" /> Overdue</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${fu.priority === "urgent" ? "bg-red-100 text-red-600" : fu.priority === "high" ? "bg-amber-100 text-amber-600" : "bg-[#edf7f2] text-[#4e927d]"}`}>{fu.priority}</span>
                      </div>
                      {fu.description && <p className="mt-1 text-sm text-[#78908a]">{fu.description}</p>}
                      <p className="mt-1 text-xs text-[#78908a]">
                        Due: {fu.dueDate} · {fu.patientName ?? fu.patientId}
                        {fu.status === "completed" && fu.completedAt && ` · Completed: ${new Date(fu.completedAt).toLocaleDateString("en-IN")}`}
                      </p>
                    </div>
                    {fu.status === "pending" && (
                      <button onClick={() => void complete(fu.id)} disabled={actionLoading === fu.id} className="shrink-0 flex items-center gap-1 rounded-lg bg-[#07947f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                      </button>
                    )}
                    {fu.status === "completed" && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#5a9b6a]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
