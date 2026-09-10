'use client';
import React, { useState } from 'react';
import { 
  Activity, ShieldCheck, Sparkles, UserCheck, Stethoscope, 
  FileText, ArrowRight, CheckCircle2, Clock, Brain, Zap, Lock, Mic, Cpu, MessageSquare 
} from 'lucide-react';

export default function AIDoctorOSLandingEnhanced() {
  const [activeTab, setActiveTab] = useState<'scribe' | 'safety' | 'brief'>('scribe');

  return (
    <div className="min-h-screen bg-[#080D14] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black relative overflow-hidden">
      
      {/* Background Neon Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-transparent blur-[160px] pointer-events-none rounded-full" />
      
      {/* 1. Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#080D14]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Activity className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              AI Doctor OS
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#ai-engine" className="hover:text-emerald-400 transition-colors">AI Engines</a>
            <a href="#interactive-demo" className="hover:text-emerald-400 transition-colors">Interactive Tour</a>
            <a href="#features" className="hover:text-emerald-400 transition-colors">Capabilities</a>
            <a href="#safety" className="hover:text-emerald-400 transition-colors">Clinical Safety</a>
          </nav>

          <div className="flex items-center gap-4">
            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/25">
              Request Clinic Demo
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="pt-24 pb-16 px-6 max-w-7xl mx-auto relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            NEXT-GEN CLINICAL INTELLIGENCE OS
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Every patient. Every detail. <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              One intelligent clinical workspace.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Eliminate 57% of administrative burden[cite: 1] with autonomous ambient listening, longitudinal patient memory, and real-time safety guardrails[cite: 1]—while the doctor maintains 100% control[cite: 1].
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2">
              Explore Interactive Demo <ArrowRight className="w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-slate-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition">
              Read Technical Specs
            </button>
          </div>
        </div>
      </section>

      {/* 3. Interactive AI Deep-Dive Section (High Interactivity) */}
      <section id="interactive-demo" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-xs font-mono text-emerald-400 tracking-wider uppercase">Experience The AI Engine</h2>
          <p className="text-3xl font-extrabold text-white">How AI Doctor OS Powers Your Consultation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <button 
            onClick={() => setActiveTab('scribe')}
            className={`p-4 rounded-xl border text-left transition ${activeTab === 'scribe' ? 'bg-emerald-500/10 border-emerald-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}
          >
            <Mic className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="font-bold text-sm">1. Vernacular Ambient Scribe</h3>
            <p className="text-xs text-slate-400 mt-1">Converts multi-language conversation into structured SOAP notes instantly[cite: 1].</p>
          </button>

          <button 
            onClick={() => setActiveTab('safety')}
            className={`p-4 rounded-xl border text-left transition ${activeTab === 'safety' ? 'bg-cyan-500/10 border-cyan-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}
          >
            <ShieldCheck className="w-5 h-5 text-cyan-400 mb-2" />
            <h3 className="font-bold text-sm">2. Real-Time Safety & PGx</h3>
            <p className="text-xs text-slate-400 mt-1">Auto-checks allergies, drug interactions, and renal dosage adjustments[cite: 1].</p>
          </button>

          <button 
            onClick={() => setActiveTab('brief')}
            className={`p-4 rounded-xl border text-left transition ${activeTab === 'brief' ? 'bg-teal-500/10 border-teal-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}
          >
            <Brain className="w-5 h-5 text-teal-400 mb-2" />
            <h3 className="font-bold text-sm">3. Longitudinal Memory & Brief</h3>
            <p className="text-xs text-slate-400 mt-1">Surfaces 10-second source-linked context and lab delta highlights[cite: 1].</p>
          </button>
        </div>

        {/* Dynamic Interactive Window */}
        <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-6 shadow-2xl">
          {activeTab === 'scribe' && (
            <div className="space-y-4 animate-fadeIn">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-mono rounded">LIVE AMBIENT SIMULATION</span>
              <p className="text-sm text-slate-300 italic">"Patient reports mild dizziness since 2 days, no chest pain. BP is stable. Continuing Metformin."</p>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 font-mono text-xs">
                <p className="text-emerald-400">[S] Subjective: Dizziness for 2 days, denies acute chest pain.</p>
                <p className="text-cyan-400">[O] Objective: BP recorded at 130/85 mmHg, lungs clear.</p>
                <p className="text-teal-400">[A] Assessment: Essential hypertension, mild fatigue.</p>
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4 animate-fadeIn">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-mono rounded">PRESCRIPTION SAFETY ENGINE</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900/80 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-slate-400">Allergy Check</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1">🟢 No Cross-Reactivity</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-yellow-500/20">
                  <p className="text-xs text-slate-400">Interaction Warning</p>
                  <p className="text-sm font-bold text-yellow-400 mt-1">🟡 Mild NSAID overlap</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-cyan-500/20">
                  <p className="text-xs text-slate-400">Renal Adjustment</p>
                  <p className="text-sm font-bold text-cyan-400 mt-1">eGFR Safe (&gt;60 mL/min)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'brief' && (
            <div className="space-y-4 animate-fadeIn">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-400 text-xs font-mono rounded">AI 10-SECOND PATIENT BRIEF</span>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 text-sm text-slate-300">
                <p>• 42-year-old male with 5-year history of Type-2 Diabetes & Hypertension[cite: 1].</p>
                <p className="text-red-400">⚠️ Critical Lab Delta: HbA1c rose from 7.1% to 8.2% in last report (Aug 15).</p>
                <p>• Current Regimen: Metformin 500mg BD, Telmisartan 40mg OD.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Advanced AI Bento Grid Features */}
      <section id="features" className="py-24 bg-slate-950/60 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-mono text-cyan-400 tracking-wider uppercase">Comprehensive Capabilities</h2>
            <p className="text-3xl md:text-4xl font-extrabold text-white">
              Built for doctors who demand clinical precision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 hover:border-emerald-500/40 transition">
              <Brain className="w-8 h-8 text-emerald-400" />
              <h4 className="text-lg font-bold text-white">Longitudinal Memory Engine</h4>
              <p className="text-sm text-slate-400">Maintains continuing patient history across visits, reports, and medication timelines without missing context[cite: 1].</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 hover:border-cyan-500/40 transition">
              <Zap className="w-8 h-8 text-cyan-400" />
              <h4 className="text-lg font-bold text-white">Proactive AI Inbox Triage</h4>
              <p className="text-sm text-slate-400">Classifies incoming patient communications into Red-Flag urgent, staff-handled, and routine items automatically[cite: 1].</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 hover:border-teal-500/40 transition">
              <Cpu className="w-8 h-8 text-teal-400" />
              <h4 className="text-lg font-bold text-white">Report Intelligence & OCR</h4>
              <p className="text-sm text-slate-400">Extracts lab values from uploaded PDFs, compares historical trends, and highlights physiological anomalies instantly[cite: 1].</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 hover:border-emerald-500/40 transition">
              <MessageSquare className="w-8 h-8 text-emerald-400" />
              <h4 className="text-lg font-bold text-white">Vernacular Audio Summaries</h4>
              <p className="text-sm text-slate-400">Dispatches localized audio instructions to patients via WhatsApp immediately after the visit concludes[cite: 1].</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 hover:border-cyan-500/40 transition">
              <ShieldCheck className="w-8 h-8 text-cyan-400" />
              <h4 className="text-lg font-bold text-white">Human Approval Gate</h4>
              <p className="text-sm text-slate-400">Absolute clinician control: AI drafts and suggests, but explicit doctor authorization signs every single action[cite: 1].</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 hover:border-teal-500/40 transition">
              <Clock className="w-8 h-8 text-teal-400" />
              <h4 className="text-lg font-bold text-white">Automated Task Engine</h4>
              <p className="text-sm text-slate-400">Locks follow-up appointments, prescription refills, and specialist referrals into an intelligent tracking queue[cite: 1].</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="border-t border-white/5 py-12 bg-[#05080E]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-slate-300 text-sm">AI Doctor OS</span>
          </div>
          <p className="text-xs text-slate-500">
            © 2026 AI Doctor OS. AI assists. Doctors decide. Patients remain at the center[cite: 1].
          </p>
        </div>
      </footer>

    </div>
  );
}
