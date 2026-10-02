import { Brain, Zap, FileText, ShieldCheck, Clock, Mic, Users, ArrowUpRight } from "lucide-react";

const stats = [
  { value: "One", label: "longitudinal patient story", description: "Visits, reports, medications, referrals, and follow-ups stay connected instead of living in separate screens.", gradient: "from-emerald-400 to-teal-300" },
  { value: "Before", label: "the action, not after", description: "Relevant context and safety checks appear before a prescription, message, or follow-up is finalized.", gradient: "from-cyan-400 to-emerald-300" },
  { value: "Every", label: "AI output reviewable", description: "The system separates facts, derived insights, AI drafts, and doctor-authored decisions so the record stays trustworthy.", gradient: "from-teal-300 to-emerald-400" },
];

const capabilities = [
  { icon: Brain, title: "Patient memory", description: "Build a timeline from structured visits, medications, reports, vitals, and care events." },
  { icon: Zap, title: "Decision-ready brief", description: "Get a source-linked snapshot of what matters before entering the room." },
  { icon: Mic, title: "Voice clinical notes", description: "Turn the conversation into a structured draft while the doctor stays present." },
  { icon: FileText, title: "Report intelligence", description: "Extract results, compare historical values, and flag changes that need attention." },
  { icon: ShieldCheck, title: "Prescription safety", description: "Check allergies, interactions, duplication, and dosage before review and sign-off." },
  { icon: Clock, title: "Follow-up intelligence", description: "Keep referrals, tasks, reminders, and unresolved work visible after the visit." },
];

export default function ProblemsSection() {
  return (
    <section id="about" className="scroll-mt-24 py-24 bg-slate-950/80 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-12"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Why every setting needs an operating layer</p><h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">The hard part is not storing data. It is knowing what to do next.</h2><p className="mt-4 text-slate-400 leading-relaxed">Patients wait without knowing why, and doctors lose time rebuilding context that already exists somewhere — a message, a report, a memory. AI UPCHAR turns those disconnected moments into one guided journey, from a government hospital queue to a single-doctor clinic.</p></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-5">{stats.map((s) => <div key={s.value} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b border-white/10 pb-5 sm:gap-5"><div className={`min-w-0 whitespace-nowrap text-3xl leading-none md:text-4xl font-black bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.value}</div><div className="min-w-0"><p className="font-semibold text-white">{s.label}</p><p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-400">{s.description}</p></div></div>)}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{capabilities.map(({ icon: Icon, title, description }) => <div key={title} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3"><div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0"><Icon className="w-4 h-4" /></div><div><p className="text-sm font-semibold text-white">{title}</p><p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p></div></div>)}</div>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400"><Users className="w-4 h-4 text-emerald-400" />Built for doctors, reception teams, care coordinators, clinic admins, and patients working from the same approved record.<ArrowUpRight className="w-4 h-4 text-emerald-400" /></div>
      </div>
    </section>
  );
}
