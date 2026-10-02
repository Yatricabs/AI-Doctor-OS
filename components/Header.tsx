"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { Menu, Stethoscope, X } from "lucide-react";

const navItems = [
  { label: "Home", id: "home", href: "/#home" },
  { label: "For Patients", id: "for-patients", href: "/#for-patients" },
  { label: "For Doctors", id: "for-doctors", href: "/#for-doctors" },
  { label: "How It Works", id: "how-it-works", href: "/#how-it-works" },
  { label: "Features", id: "features", href: "/#features" },
  { label: "About", id: "about", href: "/#about" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  function navigateToSection(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    if (typeof document === "undefined") return;
    const section = document.getElementById(sectionId);
    if (!section) return;
    event.preventDefault();
    window.history.pushState(null, "", `/#${sectionId}`);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    closeMobile();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#080D14]/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/#home" onClick={closeMobile} className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20"><Stethoscope className="h-6 w-6" strokeWidth={2.5} /></span>
          <span className="whitespace-nowrap text-[17px] font-extrabold tracking-tight text-white sm:text-xl">AI UPCHAR</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-400 lg:flex">
          {navItems.map(({ label, id, href }) => (
            <a key={label} href={href} onClick={(event) => navigateToSection(event, id)} className="transition-colors hover:text-emerald-400">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/demo" className="hidden rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-300 hover:to-teal-300 sm:inline-flex">
            Watch Demo
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-xl border border-white/10 p-2.5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#080D14]/95 px-4 py-4 shadow-2xl lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1 text-sm font-semibold text-slate-300">
            {navItems.map(({ label, id, href }) => (
              <a key={label} href={href} onClick={(event) => navigateToSection(event, id)} className="rounded-lg px-3 py-3 transition hover:bg-white/[0.06] hover:text-emerald-400">
                {label}
              </a>
            ))}
            <Link href="/demo" onClick={closeMobile} className="mt-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-3 text-center font-bold text-slate-950">
              Watch Demo
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
