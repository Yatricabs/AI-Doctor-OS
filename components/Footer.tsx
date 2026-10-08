import BrandLogo from "@/components/BrandLogo";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 bg-[#05080E]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-11 rounded-lg bg-[#071a32]" alt="" />
          <span className="font-bold text-slate-300 text-sm">AI UPCHAR</span>
        </div>
        <p className="text-xs text-slate-500">
          © 2026 AI UPCHAR. AI assists. Doctors decide. Patients remain at the center.
        </p>
      </div>
    </footer>
  );
}
