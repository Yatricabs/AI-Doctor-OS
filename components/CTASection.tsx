"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import DemoDialog from "./DemoDialog";

const demoPoints = ["See a patient profile with AI brief and live Copilot", "Walk through reports, prescription safety, and follow-ups", "Map the workflow to your clinic roles and review policies"];

export default function CTASection() {
  const [demoOpen, setDemoOpen] = useState(false);
  
  return (
    <>
      <section id="clinics" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 border border-emerald-500/30 p-8 md:p-14 overflow-hidden">
          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">See the workflow in context</p>
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Build the clinic around the doctor, <span className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">not the paperwork.</span></h2>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed">Explore how one patient moves from morning queue to consultation, approved prescription, and tracked follow-up without losing the clinical story.</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-3.5 font-bold text-slate-950 transition hover:scale-105 shadow-lg shadow-emerald-500/30">
                  Open live demo <ArrowRight className="w-4 h-4" />
                </a>
                <button onClick={() => setDemoOpen(true)} className="rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3.5 font-bold text-white transition hover:bg-white/10">
                  Request a clinic walkthrough
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">In the walkthrough</p>
              <ul className="mt-4 space-y-4">
                {demoPoints.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500">AI assists. Doctors decide. The demo uses illustrative data and is not a substitute for clinical judgment.</p>
            </div>
          </div>
        </div>
      </section>
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
