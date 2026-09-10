"use client";

import { useState } from "react";
import { Activity, Clock, FileText, X } from "lucide-react";

const metrics = [
  { label: "Patients", value: "24", color: "text-white" },
  { label: "Follow-ups", value: "7", color: "text-emerald-400" },
  { label: "AI reports", value: "3", color: "text-cyan-400" },
  { label: "Priority alerts", value: "2", color: "text-red-400" },
];

export default function DashboardMockup() {
  const [activeView, setActiveView] = useState("Dashboard");
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <div className="mt-16 relative mx-auto max-w-6xl">
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-3xl blur-xl opacity-20" />

      <div className="relative min-w-0 rounded-2xl bg-[#0F172A]/90 border border-white/10 p-4 md:p-6 shadow-2xl backdrop-blur-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 truncate text-xs font-mono text-slate-500 sm:ml-4">app.aidoctoros.com/workspace</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-mono">
            Secure live node
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
          <div className="space-y-2 bg-slate-900/50 p-3 rounded-xl border border-white/5">
            <div className="text-xs font-bold text-slate-400 px-3 py-1">Clinical workspace</div>
            {[
              { label: "Dashboard", icon: Activity },
              { label: "Appointments", icon: Clock },
              { label: "Reports AI", icon: FileText },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActiveView(label)}
                className={`w-full px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 text-left transition ${activeView === label ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          <div className="min-w-0 space-y-4 md:col-span-3">
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/30 p-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-bold text-white">{activeView === "Dashboard" ? "Good morning, Dr. Sharma" : activeView}</h3>
                <p className="text-xs text-slate-400">{activeView === "Dashboard" ? "Thursday · 10 Sep 2026 · 24 consultations scheduled" : `Your ${activeView.toLowerCase()} are ready to review.`}</p>
              </div>
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs rounded-full font-mono">
                AI agent active
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metrics.map((m) => (
                <div key={m.label} className="bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-emerald-950/30 to-slate-900/80 p-4 rounded-xl border border-emerald-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400">
                  RS
                </div>
                <div>
                  <p className="text-xs text-emerald-400 font-mono font-semibold">Next patient ready</p>
                  <h4 className="font-bold text-white">Rahul Sharma, age 42</h4>
                  <p className="text-xs text-slate-400">Routine follow-up · Hypertension track</p>
                </div>
              </div>
              <button onClick={() => setBriefOpen(true)} className="px-4 py-2 bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-300 transition">
                Open clinical brief →
              </button>
            </div>

            {briefOpen && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono font-semibold text-cyan-400">CLINICAL BRIEF · RS-042</p>
                    <h4 className="mt-1 font-bold text-white">Rahul Sharma</h4>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">Blood pressure trend is stable across the last three visits. Review current medication adherence and confirm the next follow-up window.</p>
                  </div>
                  <button onClick={() => setBriefOpen(false)} aria-label="Close clinical brief" className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
