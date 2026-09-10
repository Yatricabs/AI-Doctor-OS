import { Brain, Zap, Stethoscope, FileText, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

const features = [
  { icon: Brain, title: "Patient memory", description: "A longitudinal patient timeline across past visits, conditions, medications, reports, referrals, and follow-ups.", outcome: "Less searching before the visit" },
  { icon: Zap, title: "AI patient brief", description: "A fast, source-linked summary that highlights what changed, what matters, and what may need confirmation.", outcome: "Better-prepared consultations" },
  { icon: Stethoscope, title: "Voice clinical notes", description: "Capture the encounter naturally and generate a structured clinical draft for the doctor to review and save.", outcome: "Less typing during care" },
  { icon: FileText, title: "Report intelligence", description: "Classify documents, extract relevant values, compare historical trends, and keep review status visible.", outcome: "Reports become usable context" },
  { icon: ShieldCheck, title: "Prescription safety", description: "Surface allergy, interaction, duplication, and dosage considerations before an authorized clinician signs.", outcome: "Safety checks before action" },
  { icon: Clock, title: "Follow-up tracking", description: "Create tasks from the visit, assign ownership, monitor overdue work, and keep patients from falling through gaps.", outcome: "Care continues after checkout" },
];

export default function FeaturesGrid() {
  return (
    <section id="safety" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">A safer kind of clinical AI</p><h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Intelligence where the work happens, with the doctor in control.</h2><p className="mt-4 text-slate-400 leading-relaxed">AI UPCHAR does not silently diagnose, prescribe, modify the record, or message patients. It prepares drafts, highlights evidence, and asks for an authorized human decision.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{features.map(({ icon: Icon, title, description, outcome }) => <div key={title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4"><Icon className="w-8 h-8 text-emerald-400" /><div><h3 className="text-lg font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p></div><div className="flex items-center gap-2 border-t border-white/10 pt-3 text-xs font-semibold text-emerald-400"><CheckCircle2 className="w-4 h-4" />{outcome}</div></div>)}</div>
      </div>
    </section>
  );
}
