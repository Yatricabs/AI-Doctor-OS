"use client";

// Editable, printable prescription letter for the doctor. Pre-fills medicines/
// tests/advice from the AI report's treatment recommendation; the doctor edits,
// saves (via /api/prescriptions), and prints. Review-required: the doctor signs.
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { apiSend } from "./api";

type Item = { medicationName: string; dose: string; frequency: string; duration: string };
type Prefill = {
  medicines?: string[];   // AI treatmentMedicines
  tests?: string[];       // AI testsInitial
  advice?: string[];      // AI treatmentMeasures
};

const EMPTY: Item = { medicationName: "", dose: "", frequency: "Once daily", duration: "" };
const FREQ = ["Once daily", "Twice daily", "Thrice daily", "Once at night", "Every 8 hours", "As needed (SOS)"];

// Split an AI medicine string like "Metformin 500mg twice daily" into fields (best effort).
function parseMedicine(s: string): Item {
  const dose = s.match(/\d+\s?(mg|mcg|ml|g|iu|units?)/i)?.[0] ?? "";
  const name = s.split(/\d/)[0].trim() || s.trim();
  return { medicationName: name, dose, frequency: "Once daily", duration: "" };
}

export default function PrescriptionLetter({
  patientId, patientName, patientMeta, appointmentId, prefill, onClose, onSaved,
}: {
  patientId: string;
  patientName: string;
  patientMeta?: string;      // e.g. "39 · Male · RM-102"
  appointmentId?: string;
  prefill?: Prefill;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [tests, setTests] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // Pre-fill from the AI report on open.
  useEffect(() => {
    const meds = (prefill?.medicines ?? []).map(parseMedicine);
    setItems(meds.length ? meds : [{ ...EMPTY }]);
    setTests((prefill?.tests ?? []).join(", "));
    setAdvice((prefill?.advice ?? []).join("; "));
  }, [prefill]);

  function update(i: number, k: keyof Item, v: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  }
  function addItem() { setItems((p) => [...p, { ...EMPTY }]); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  async function save() {
    const valid = items.filter((i) => i.medicationName.trim());
    setSaving(true); setError("");
    try {
      const notesParts = [tests.trim() ? `Tests advised: ${tests.trim()}` : "", advice.trim() ? `Advice: ${advice.trim()}` : "", followUp.trim() ? `Follow-up: ${followUp.trim()}` : ""].filter(Boolean);
      const created = await apiSend<{ prescription: { id: string } }>("/api/prescriptions", "POST", {
        action: "create", patientId, visitId: appointmentId,
        notes: notesParts.join(" | "),
        items: valid.map((it) => ({ medicationName: it.medicationName, dose: it.dose, frequency: it.frequency, duration: it.duration })),
      });
      // Sign it so it becomes a real, active prescription.
      await apiSend("/api/prescriptions", "POST", { action: "sign", prescriptionId: created.prescription.id }).catch(() => {});
      setSaved(true);
      onSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save prescription."); }
    finally { setSaving(false); }
  }

  function print() {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Prescription — ${patientName}</title>
      <style>
        body{font-family:Georgia,serif;color:#1f2d2b;padding:40px;max-width:720px;margin:auto}
        h1{color:#07634f;margin:0}
        .muted{color:#6b7c78;font-size:13px}
        hr{border:none;border-top:2px solid #07947f;margin:14px 0}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #dde}
        th{font-size:12px;text-transform:uppercase;color:#5a7a6e}
        .rx{font-size:28px;color:#07634f;font-weight:bold}
        .sec{margin-top:16px}
        .sec b{color:#07634f}
        .sign{margin-top:48px;text-align:right}
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#eef4f1] px-6 py-4">
          <h2 className="text-lg font-bold text-[#173f3c]">Prescription letter</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#8a9e98]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">{error}</div>}
          {saved && <div className="mb-3 rounded-lg border border-[#c2ddd5] bg-[#f0faf5] p-2.5 text-sm text-[#317b67]">Prescription saved &amp; signed. You can print it now.</div>}

          <p className="mb-2 text-[11px] text-[#8a9e98]">Pre-filled from the AI report — review and edit before signing. The clinician is responsible for the final prescription.</p>

          {/* Medicines */}
          <p className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Medicines</p>
          <div className="mt-1.5 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e4efe9] bg-[#fbfdfc] p-2">
                <input value={it.medicationName} onChange={(e) => update(i, "medicationName", e.target.value)} placeholder="Medicine" className="min-w-[140px] flex-1 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
                <input value={it.dose} onChange={(e) => update(i, "dose", e.target.value)} placeholder="Dose" className="w-20 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
                <select value={it.frequency} onChange={(e) => update(i, "frequency", e.target.value)} className="rounded border border-[#dce9e3] px-2 py-1 text-xs outline-none">
                  {FREQ.map((f) => <option key={f}>{f}</option>)}
                </select>
                <input value={it.duration} onChange={(e) => update(i, "duration", e.target.value)} placeholder="Duration" className="w-24 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
                <button onClick={() => removeItem(i)} aria-label="Remove"><Trash2 className="h-4 w-4 text-red-400" /></button>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#07947f]"><Plus className="h-3.5 w-3.5" /> Add medicine</button>

          <div className="mt-4 grid gap-3">
            <Field label="Tests advised"><input value={tests} onChange={(e) => setTests(e.target.value)} placeholder="e.g. CBC, Stool test" className="in" /></Field>
            <Field label="Advice / instructions"><textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={2} placeholder="e.g. Stay hydrated, avoid oily food" className="in" /></Field>
            <Field label="Follow-up"><input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Review in 5 days" className="in" /></Field>
          </div>

          {/* Hidden printable letter */}
          <div className="hidden">
            <div ref={printRef}>
              <h1>AI UPCHAR Clinic</h1>
              <p className="muted">Dr. Ananya Arya · General Medicine · Reg. no. XXXXXX</p>
              <hr />
              <p><b>Patient:</b> {patientName}{patientMeta ? ` (${patientMeta})` : ""}</p>
              <p className="muted">Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="rx">℞</p>
              <table>
                <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
                <tbody>
                  {items.filter((i) => i.medicationName.trim()).map((it, i) => (
                    <tr key={i}><td>{it.medicationName}</td><td>{it.dose}</td><td>{it.frequency}</td><td>{it.duration}</td></tr>
                  ))}
                </tbody>
              </table>
              {tests.trim() && <p className="sec"><b>Tests advised:</b> {tests}</p>}
              {advice.trim() && <p className="sec"><b>Advice:</b> {advice}</p>}
              {followUp.trim() && <p className="sec"><b>Follow-up:</b> {followUp}</p>}
              <div className="sign"><p>_______________________<br />Dr. Ananya Arya</p></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eef4f1] px-6 py-4">
          <button onClick={print} className="flex items-center gap-2 rounded-xl border border-[#dce9e3] px-4 py-2.5 text-sm font-bold text-[#317b67] hover:bg-[#f0f6f3]"><Printer className="h-4 w-4" /> Print</button>
          <button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save &amp; sign</button>
        </div>
      </div>

      <style jsx>{`
        .in { width: 100%; border: 1px solid #dce9e3; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .in:focus { border-color: #07947f; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5a967e]">{label}</span>
      {children}
    </label>
  );
}
