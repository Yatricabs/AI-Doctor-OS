"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, ClipboardList, BrainCircuit, ShieldCheck, UserRound, Info, Mail, ChevronDown } from "lucide-react";
import DemoDialog from "./DemoDialog";

const navItems = [
  { label: "Product", icon: ClipboardList, href: "/product" },
  { label: "Workflow", icon: BrainCircuit, href: "/workflow" },
  { label: "For doctors", icon: UserRound, href: "/for-doctors" },
  { label: "Security", icon: ShieldCheck, href: "/security" },
  { label: "About", icon: Info, href: "/about" },
  { label: "Contact", icon: Mail, href: "/contact" },
];

const platformLinks = [
  { label: "Morning Brief", href: "/doctor/morning-brief" },
  { label: "Queue", href: "/doctor/queue" },
  { label: "AI Inbox", href: "/doctor/inbox" },
  { label: "Patient Portal", href: "/patient/portal" },
  { label: "Book Appointment", href: "/patient/book" },
  { label: "Reception", href: "/reception/checkin" },
  { label: "Analytics", href: "/admin/analytics" },
];

export default function Header() {
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#080D14]/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20"><Stethoscope className="h-6 w-6" strokeWidth={2.5} /></span>
            <span className="whitespace-nowrap text-[17px] font-extrabold tracking-tight text-white sm:text-xl">AI UPCHAR</span>
          </Link>
          <nav className="hidden items-center gap-4 text-xs font-medium text-slate-400 md:flex">
            {navItems.map(({ label, icon: Icon, href }) => (
              <Link key={label} href={href} className="flex items-center gap-1.5 transition-colors hover:text-emerald-400">
                <Icon className="h-4 w-4" />{label}
              </Link>
            ))}
            {/* Platform dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors">
                Platform <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="absolute left-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#0F172A] py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all shadow-xl z-50">
                {platformLinks.map(({ label, href }) => (
                  <Link key={label} href={href} className="block px-4 py-2 text-xs text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-colors">{label}</Link>
                ))}
              </div>
            </div>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/demo" className="hidden rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200 sm:inline-flex">Open live demo</Link>
            <button onClick={() => setDemoOpen(true)} className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-300 hover:to-teal-300 sm:px-5 sm:text-sm">
              <span className="sm:hidden">Request demo</span><span className="hidden sm:inline">Request a free demo</span>
            </button>
          </div>
        </div>
      </header>
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
