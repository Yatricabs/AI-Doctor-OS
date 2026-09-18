"use client";

import { useEffect, useState } from "react";
import { Globe, Smartphone, MessageCircle, Phone, CheckCircle2, Mic } from "lucide-react";

type ChannelKey = "whatsapp" | "app" | "voice" | "website";

const channels: Record<
  ChannelKey,
  { icon: typeof Globe; label: string; title: string; summary: string; who: string; points: string[] }
> = {
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp AI chat",
    who: "For every patient, no app required",
    title: "The visit starts on WhatsApp — days before the appointment.",
    summary:
      "Patients book, upload an old prescription or lab report, and describe symptoms by voice or text, in their own language.",
    points: [
      "Documents are classified and linked to the patient automatically",
      "Voice notes and free text both become structured intake",
      "Nothing to install — it's the app families already use",
    ],
  },
  voice: {
    icon: Phone,
    label: "Voice call",
    who: "For anyone a smartphone leaves behind",
    title: "A phone call does the same intake, in the caller's own language.",
    summary:
      "No literacy or smartphone requirement — the same AI intake, priority, and pre-visit brief, reached with a phone call.",
    points: [
      "Works on any phone, in the caller's language",
      "Same priority engine and pre-visit brief as every other channel",
      "Built for government-hospital and rural reach",
    ],
  },
  app: {
    icon: Smartphone,
    label: "Mobile app",
    who: "For returning patients, doctors, and clinic teams",
    title: "A faster home for people already inside the ecosystem.",
    summary:
      "Patient history, live queue position, and the doctor workspace — in one place, for people who come back.",
    points: [
      "Live queue position and estimated consultation time",
      "Full document vault and visit history",
      "Doctor workspace and Copilot, on the go",
    ],
  },
  website: {
    icon: Globe,
    label: "Website",
    who: "For facilities, front desks, and admin teams",
    title: "The system of record for the clinic or hospital.",
    summary:
      "Scheduling, department routing, doctor workload, and facility-wide queue visibility, all in one dashboard.",
    points: [
      "Multi-department appointment orchestration",
      "Facility-level priority and governance rules",
      "Doctor and admin dashboards side by side",
    ],
  },
};

const order: ChannelKey[] = ["website", "app", "whatsapp", "voice"];

export default function PatientChannelsSection() {
  const [active, setActive] = useState<ChannelKey>("website");
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      setActive((current) => order[(order.indexOf(current) + 1) % order.length]);
    }, 4500);
    return () => clearInterval(timer);
  }, [autoRotate]);

  function selectTab(key: ChannelKey) {
    setAutoRotate(false);
    setActive(key);
  }

  const channel = channels[active];
  const Icon = channel.icon;

  return (
    <section id="channels" className="border-y border-white/5 bg-slate-950/60 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Website · App · WhatsApp · Voice call
          </p>
          <h2 className="mt-4 text-3xl font-extrabold text-white md:text-4xl">
            One AI layer. Every door into care.
          </h2>
          <p className="mt-4 leading-relaxed text-slate-400">
            AI UPCHAR meets patients and doctors wherever they already are. Whichever door a patient
            walks through, the doctor sees the same prepared story on the other side.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {order.map((key) => {
            const item = channels[key];
            const ItemIcon = item.icon;
            return (
              <button
                key={key}
                onClick={() => selectTab(key)}
                className={`rounded-xl border p-4 text-left transition ${
                  active === key
                    ? "border-emerald-400/50 bg-emerald-500/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <ItemIcon className={`mb-3 h-5 w-5 ${active === key ? "text-emerald-400" : "text-slate-500"}`} />
                <p className="text-sm font-bold">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.who}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid min-w-0 gap-8 rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:p-8">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded bg-emerald-500/15 px-3 py-1 text-xs font-mono font-bold text-emerald-400">
              <Icon className="h-3.5 w-3.5" /> {channel.label}
            </span>
            <h3 className="mt-5 text-2xl font-bold text-white">{channel.title}</h3>
            <p className="mt-3 max-w-xl leading-relaxed text-slate-400">{channel.summary}</p>
            <div className="mt-6 space-y-3">
              {channel.points.map((point) => (
                <div key={point} className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 p-5">
            {active === "whatsapp" && (
              <div className="space-y-2.5">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-3.5 py-2.5 text-xs text-slate-200">
                  Papa&apos;s chest has been hurting since Tuesday.
                  <div className="mt-1 text-[10px] text-slate-500">Voice note · 0:42</div>
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-100">
                  Got it. Sending an old report or prescription helps too.
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-3.5 py-2.5 text-xs text-slate-200">
                  Uploading now.
                  <div className="mt-1 inline-block rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">
                    Report_Feb2026.pdf
                  </div>
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-100">
                  Any swelling or breathlessness?
                </div>
              </div>
            )}

            {active === "voice" && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <Mic className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-white">AI UPCHAR Assistant</p>
                <p className="mb-5 text-xs text-slate-500">Listening · 01:24</p>
                <div className="mb-5 flex items-end gap-1">
                  {[10, 20, 8, 24, 12, 18, 9, 22, 14].map((h, i) => (
                    <span key={i} className="w-1 rounded-full bg-emerald-400/70" style={{ height: `${h}px` }} />
                  ))}
                </div>
                <p className="max-w-[220px] rounded-lg bg-white/[0.05] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                  &quot;…any fever along with the cough? For how many days?&quot;
                </p>
              </div>
            )}

            {active === "app" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Your position today</p>
                  <p className="mt-1 text-sm font-bold text-white">#5 in queue</p>
                  <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    ~4:20 – 4:45 PM
                  </span>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Appointment</p>
                  <p className="mt-1 text-sm font-bold text-white">Dr. Iyer · Cardiology</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">Status</p>
                  <p className="mt-1 text-sm font-bold text-emerald-200">Pre-visit brief ready</p>
                </div>
              </div>
            )}

            {active === "website" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Today&apos;s clinic</p>
                  <span className="text-[10px] font-semibold text-emerald-400">Live</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="text-slate-300">Patients today</span>
                  <span className="font-bold text-white">24</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="text-slate-300">Priority alerts</span>
                  <span className="font-bold text-emerald-300">2</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="text-slate-300">Follow-ups due</span>
                  <span className="font-bold text-white">7</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
