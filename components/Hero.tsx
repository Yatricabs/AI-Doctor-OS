"use client";

import { PlayCircle } from "lucide-react";
import Link from "next/link";
import DashboardMockup from "./DashboardMockup";

const floatingBadges = [
  { label: "WhatsApp-ready", className: "" },
  { label: "Voice call-ready", className: "" },
  { label: "Clinician-controlled", className: "" },
  { label: "Every setting", className: "" },
];
const floatingCaptions = [
  "Patient intake before the visit",
  "Reaches anyone with a phone",
  "Doctor approves every action",
  "Govt hospital, private hospital, clinic",
];

export default function Hero() {
  function scrollToSection(id: string) {
    if (typeof document !== "undefined") {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  return (
    <section id="product" className="pt-20 pb-16 px-6 max-w-7xl mx-auto relative">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[min(1000px,100%)] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-transparent blur-[140px]" />
      <div className="text-center max-w-4xl mx-auto space-y-6 relative">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">Website · App · WhatsApp · Voice call</p>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">Every visit starts{" "}<span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">before the patient walks in</span>{" "}and the doctor knows it.</h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">Patients book, upload reports, and describe their problem on WhatsApp, in the app, or with a phone call. AI UPCHAR turns that into a prepared, prioritized visit — for government hospitals, private hospitals, and clinics alike. AI prepares the context; the doctor reviews every decision.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button onClick={() => scrollToSection("channels")} className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2">
            <PlayCircle className="w-5 h-5" /> See how it works
          </button>
          <Link href="/for-doctors" className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-slate-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition text-center">
            For clinics & hospitals
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-slate-500"><span>Pre-visit intake on WhatsApp or a call</span><span>Priority &amp; live queue for every patient</span><span>Doctor approves every action</span></div>
      </div>
      <div className="relative">
        <div className="mx-auto mb-8 hidden max-w-6xl items-center justify-between gap-6 px-8 lg:flex">
          {floatingBadges.map((b, index) => <div key={b.label} className="flex flex-1 flex-col items-center gap-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">{floatingCaptions[index]}</span>
            <span className={`${b.className} inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-slate-300`}>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />{b.label}
            </span>
          </div>)}
        </div>
        <DashboardMockup />
      </div>
    </section>
  );
}
