"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, ClipboardList, BrainCircuit, ShieldCheck, UserRound } from "lucide-react";
import DemoDialog from "./DemoDialog";

const navItems = [
  { label: "Product", icon: ClipboardList, href: "/product" },
  { label: "Workflow", icon: BrainCircuit, href: "/workflow" },
  { label: "For doctors", icon: UserRound, href: "/for-doctors" },
  { label: "Security", icon: ShieldCheck, href: "/security" },
];

export default function Header() {
  const [demoOpen, setDemoOpen] = useState(false);
  return <><header className="sticky top-0 z-50 border-b border-white/5 bg-[#080D14]/80 backdrop-blur-md"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6"><Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20"><Stethoscope className="h-6 w-6" strokeWidth={2.5} /></span><span className="text-xl font-extrabold tracking-tight text-white">AI Doctor OS</span></Link><nav className="hidden items-center gap-7 text-sm font-medium text-slate-400 md:flex">{navItems.map(({ label, icon: Icon, href }) => <Link key={label} href={href} className="flex items-center gap-1.5 transition-colors hover:text-emerald-400"><Icon className="h-4 w-4" />{label}</Link>)}</nav><div className="flex items-center gap-2"><Link href="/demo" className="hidden rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200 sm:inline-flex">Open live demo</Link><button onClick={() => setDemoOpen(true)} className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-300 hover:to-teal-300">Request a free demo</button></div></div></header><DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} /></>;
}
