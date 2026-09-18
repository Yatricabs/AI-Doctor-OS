import Link from "next/link";
import { Activity } from "lucide-react";

const footerLinks = [
  { label: "Product", href: "/product" },
  { label: "For patients", href: "/for-patients" },
  { label: "Workflow", href: "/workflow" },
  { label: "For doctors", href: "/for-doctors" },
  { label: "Security", href: "/security" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Open live demo", href: "/demo" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 bg-[#05080E]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-slate-300 text-sm">AI UPCHAR</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-400">
            {footerLinks.map(({ label, href }) => (
              <Link key={label} href={href} className="hover:text-emerald-400 transition-colors">{label}</Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-white/5 pt-6 text-xs text-slate-500">
          © 2026 AI UPCHAR. AI assists. Doctors decide. Patients remain at the center.
        </p>
      </div>
    </footer>
  );
}
