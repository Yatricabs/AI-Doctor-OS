"use client";

import { PlayCircle } from "lucide-react";
import DashboardMockup from "./DashboardMockup";

const floatingBadges = [
  { label: "AI-assisted", className: "top-2 left-8 md:left-24 -rotate-3" },
  { label: "Clinician-controlled", className: "top-0 right-16 md:right-40 rotate-2" },
  { label: "Safe and secure", className: "top-32 right-4 md:right-12 -rotate-2" },
  { label: "Clinic-ready", className: "top-72 right-0 md:right-4 rotate-1" },
];

export default function Hero() {
  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section id="product" className="pt-20 pb-16 px-6 max-w-7xl mx-auto relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-transparent blur-[140px] pointer-events-none rounded-full" />
      <div className="text-center max-w-4xl mx-auto space-y-6 relative">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">The clinical operating layer for modern practices</p>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">The clinical workspace that helps doctors{" "}<span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">remember, reason, and act</span>{" "}with confidence.</h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">Bring patient history, reports, consultation notes, prescriptions, and follow-ups into one clinician-controlled workspace. AI prepares the context and drafts the work; the doctor reviews every clinical decision.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"><button onClick={() => scrollToSection("workflow")} className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"><PlayCircle className="w-5 h-5" /> See how it works</button><button onClick={() => scrollToSection("clinics")} className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-slate-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition">For clinics</button></div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-slate-500"><span>Patient context before the visit</span><span>Human approval before action</span><span>Every step stays auditable</span></div>
      </div>
      <div className="relative">{floatingBadges.map((b) => <span key={b.label} className={`hidden lg:flex absolute ${b.className} px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-semibold items-center gap-2 z-10`}><span className="w-2 h-2 rounded-full bg-emerald-400" />{b.label}</span>)}<DashboardMockup /></div>
    </section>
  );
}

