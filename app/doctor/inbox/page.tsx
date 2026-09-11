"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, Inbox,
  LayoutDashboard, ListTodo, MessageSquare, RefreshCw,
  Stethoscope, Users, ChevronRight, ShieldAlert, Clipboard
} from "lucide-react";

type InboxItem = {
  id: string;
  patientId?: string;
  patientName?: string;
  patientInitials?: string;
  category: string;
  title: string;
  detail: string;
  priority: string;
  status: string;
  dueAt?: string;
  actionRequired?: string;
  createdAt: string;
};

const categoryIcon: Record<string, React.ElementType> = {
  result: FileText,
  follow_up: Clock,
  message: MessageSquare,
  task: Clipboard,
  safety: ShieldAlert,
  referral: ChevronRight,
};

const priorityBg: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500 bg-red-50",
  high: "border-l-4 border-l-amber-400 bg-amber-50",
  medium: "border-l-4 border-l-blue-400 bg-blue-50",
  low: "border-l-4 border-l-gray-300 bg-white",
};

const CATEGORIES = ["all", "result", "follow_up", "message", "task", "safety", "referral"];

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState({ total: 0, urgentCount: 0, highCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [actionLoading, setActionLoading] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeCategory !== "all" ? `/api/inbox?category=${activeCategory}` : "/api/inbox";
      const res = await fetch(url);
      const payload = await res.json() as { ok: boolean; data: { items: InboxItem[]; total: number; urgentCount: number; highCount: number } };
      if (payload.ok) {
        setItems(payload.data.items);
        setStats({ total: payload.data.total, urgentCount: payload.data.urgentCount, highCount: payload.data.highCount });
      }
    } catch { setError("Could not load inbox."); }
    finally { setLoading(false); }
  }, [activeCategory]);

  useEffect(() => { void load(); }, [load]);

  async function resolve(itemId: string) {
    setActionLoading(itemId);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", itemId }),
      });
      const payload = await res.json() as { ok: boolean };
      if (payload.ok) { setNotice("Item resolved."); await load(); }
    } catch { setError("Could not resolve item."); }
    finally { setActionLoading(""); }
  }

  async function markInProgress(itemId: string) {
    setActionLoading(itemId);
    try {
      await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "in_progress", itemId }),
      });
      setNotice("Marked in progress.");
      await load();
    } catch { setError("Action failed."); }
    finally { setActionLoading(""); }
  }

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
            { label: "AI Inbox", icon: Inbox, href: "/doctor/inbox", active: true },
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">AI Inbox</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">Inbox <span className="ml-2 text-base font-normal text-[#78908a]">{stats.total} open</span></h1>
            </div>
            <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[#dce9e3] px-3 py-2 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3]">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-6 md:px-8">
          {notice && <div className="mb-4 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-3 text-sm text-[#317b67]">{notice}</div>}
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-[#e1e9e5] bg-white p-4 text-center">
              <p className="text-2xl font-bold text-[#173f3c]">{stats.total}</p>
              <p className="text-xs text-[#78908a] mt-1">Open items</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.urgentCount}</p>
              <p className="text-xs text-red-500 mt-1">Urgent</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.highCount}</p>
              <p className="text-xs text-amber-500 mt-1">High priority</p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mb-5 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${activeCategory === cat ? "bg-[#124b47] text-white" : "border border-[#dce9e3] bg-white text-[#54716d] hover:bg-[#f0f6f3]"}`}>
                {cat === "follow_up" ? "Follow-up" : cat}
              </button>
            ))}
          </div>

          {/* Items */}
          {loading && items.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading inbox…</p>}
          {!loading && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#c2ddd5] p-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#5a9b6a]" />
              <p className="text-sm font-semibold text-[#317b67]">Inbox is clear.</p>
              <p className="mt-1 text-xs text-[#78908a]">No open items in this category.</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item) => {
              const Icon = categoryIcon[item.category] ?? Clipboard;
              return (
                <div key={item.id} className={`rounded-xl ${priorityBg[item.priority] ?? "bg-white border border-[#e1e9e5]"} p-4`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.priority === "urgent" ? "bg-red-100 text-red-500" : item.priority === "high" ? "bg-amber-100 text-amber-600" : "bg-[#edf7f2] text-[#4e927d]"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#78908a]">{item.category.replace("_", " ")}</span>
                        {item.priority === "urgent" && <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600"><AlertTriangle className="h-3 w-3" /> URGENT</span>}
                        {item.patientName && <span className="text-[10px] text-[#78908a]">· {item.patientName}</span>}
                      </div>
                      <p className="mt-1 font-semibold text-[#173f3c]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#78908a] line-clamp-2">{item.detail}</p>
                      {item.actionRequired && <p className="mt-1 text-xs font-medium text-[#5a7a6e]">→ {item.actionRequired}</p>}
                      {item.dueAt && <p className="mt-1 text-[11px] text-[#78908a]">Due: {new Date(item.dueAt).toLocaleDateString("en-IN")}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => void resolve(item.id)} disabled={actionLoading === item.id} className="rounded-lg bg-[#07947f] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Resolve
                      </button>
                      <button onClick={() => void markInProgress(item.id)} disabled={actionLoading === item.id} className="rounded-lg border border-[#dce9e3] px-3 py-1.5 text-[11px] font-semibold text-[#54716d] disabled:opacity-50">
                        In progress
                      </button>
                    </div>
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
