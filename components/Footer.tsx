import { Activity } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 bg-[#05080E]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-slate-300 text-sm">AI Doctor OS</span>
        </div>
        <p className="text-xs text-slate-500">
          © 2026 AI Doctor OS. AI assists. Doctors decide. Patients remain at the center.
        </p>
      </div>
    </footer>
  );
}
