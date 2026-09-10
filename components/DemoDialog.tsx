"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

type DemoDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function DemoDialog({ open, onClose }: DemoDialogProps) {
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function handleClose() {
    setSubmitted(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl md:p-8">
        <button onClick={handleClose} aria-label="Close demo request" className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 id="demo-dialog-title" className="mt-4 text-2xl font-bold text-white">Request received</h2>
            <p className="mt-2 text-sm text-slate-400">We&apos;ll be in touch to arrange your clinic walkthrough.</p>
            <button onClick={handleClose} className="mt-6 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 id="demo-dialog-title" className="text-2xl font-bold text-white">Request a free demo</h2>
              <p className="mt-2 text-sm text-slate-400">See how AI UPCHAR can fit your clinical workflow.</p>
            </div>
            <label className="block text-sm font-medium text-slate-300">Work email
              <input required type="email" placeholder="doctor@clinic.com" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400" />
            </label>
            <label className="block text-sm font-medium text-slate-300">Clinic name
              <input required type="text" placeholder="Your clinic" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400" />
            </label>
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 px-5 py-3 font-bold text-slate-950 transition hover:opacity-90">Book my walkthrough</button>
          </form>
        )}
      </div>
    </div>
  );
}