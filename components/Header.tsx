"use client";

import { useState } from "react";
import { Stethoscope, ClipboardList, BrainCircuit, ShieldCheck, Building2 } from "lucide-react";
import DemoDialog from "./DemoDialog";

const navItems = [
  { label: "Product", icon: ClipboardList, href: "#product" },
  { label: "Why AI", icon: BrainCircuit, href: "#workflow" },
  { label: "Safety", icon: ShieldCheck, href: "#safety" },
  { label: "Clinics", icon: Building2, href: "#clinics" },
];

export default function Header() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#080D14]/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Stethoscope className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            AI Doctor OS
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          {navItems.map(({ label, icon: Icon, href }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </a>
          ))}
        </nav>

        <a href="/demo" className="hidden sm:inline-flex px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition">Open live demo</a><button onClick={() => setDemoOpen(true)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/25 active:scale-95">
          Request a free demo
        </button>
      </div>
      </header>
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}

