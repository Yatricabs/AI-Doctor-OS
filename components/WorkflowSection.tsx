import { MessageCircle, Sparkles, MessageSquareText, CheckCircle2, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Patient reaches out — WhatsApp, app, or a call",
    description: "Booking, symptoms by voice or text, and old reports or prescriptions — all captured in the patient's own language, no app required.",
    detail: "Smart intake",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "AI prepares the visit in advance",
    description: "A pre-visit brief, a priority tag — urgent, routine, or follow-up — and any missing information are ready before the doctor opens the file.",
    detail: "Pre-visit intelligence + priority engine",
  },
  {
    number: "03",
    icon: MessageSquareText,
    title: "Doctor consults with the full story",
    description: "Open a patient profile with longitudinal history, medications, reports, vitals, voice notes, and an AI brief in one focused workspace.",
    detail: "Patient memory + Copilot",
  },
  {
    number: "04",
    icon: CheckCircle2,
    title: "Decisions turn into tracked care",
    description: "Review the note, check prescription safety, create follow-ups, send approved instructions, and keep every next step connected to the patient.",
    detail: "Review gates + care continuity",
  },
];

export default function WorkflowSection() {
  return (
    <section id="workflow" className="py-20 max-w-7xl mx-auto px-6">
      <div className="max-w-2xl mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">One connected patient journey</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">From the first WhatsApp message to a decision-ready visit.</h2>
        <p className="mt-4 text-slate-400 leading-relaxed">AI UPCHAR follows the way care actually happens: prepare before the visit, support the consultation, and keep the work moving after the patient leaves.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map(({ number, icon: Icon, title, description, detail }, index) => (
          <div key={title} className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            {index < steps.length - 1 && (
              <ArrowRight className="hidden lg:block absolute -right-5 top-12 w-5 h-5 text-emerald-400 z-10" />
            )}
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-slate-600">{number}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
            </div>
            <p className="border-t border-white/10 pt-3 text-xs font-semibold text-emerald-400">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
