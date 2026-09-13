"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { apiGet, apiSend } from "./api";
import { formatINR } from "@/lib/format";

type Category = "medicine" | "test" | "scan";
type InventoryItem = { id: string; name: string; category: Category; unit?: string; price: number };
type Item = { medicationName: string; dose: string; frequency: string; duration: string; quantity: number; inventoryItemId: string | null; unitPrice: number };
type Service = { id: string; name: string; category: "test" | "scan"; quantity: number; unitPrice: number };
type Prefill = { medicines?: string[]; tests?: string[]; advice?: string[] };

const EMPTY: Item = { medicationName: "", dose: "", frequency: "Once daily", duration: "", quantity: 1, inventoryItemId: null, unitPrice: 0 };
const FREQ = ["Once daily", "Twice daily", "Thrice daily", "Once at night", "Every 8 hours", "As needed (SOS)"];

function parseMedicine(s: string): Item {
  const dose = s.match(/\d+\s?(mg|mcg|ml|g|iu|units?)/i)?.[0] ?? "";
  const name = s.split(/\d/)[0].trim() || s.trim();
  return { ...EMPTY, medicationName: name, dose };
}

export default function PrescriptionLetter({ patientId, patientName, patientMeta, appointmentId, prefill, onClose, onSaved }: {
  patientId: string; patientName: string; patientMeta?: string; appointmentId?: string; prefill?: Prefill; onClose: () => void; onSaved?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [tests, setTests] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [medicineQuery, setMedicineQuery] = useState("");
  const [activeMedicine, setActiveMedicine] = useState<number | null>(null);
  const [activeService, setActiveService] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const medicineBoxRef = useRef<HTMLDivElement>(null);
  const serviceBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const meds = (prefill?.medicines ?? []).map(parseMedicine);
    setItems(meds.length ? meds : [{ ...EMPTY }]);
    setTests((prefill?.tests ?? []).join(", "));
    setAdvice((prefill?.advice ?? []).join("; "));
  }, [prefill]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInventoryLoading(true); setInventoryError("");
      try {
        const [medicines, testItems, scans] = await Promise.all([
          apiGet<{ items: InventoryItem[] }>("/api/inventory?category=medicine"),
          apiGet<{ items: InventoryItem[] }>("/api/inventory?category=test"),
          apiGet<{ items: InventoryItem[] }>("/api/inventory?category=scan"),
        ]);
        if (!cancelled) setInventory([...medicines.items, ...testItems.items, ...scans.items]);
      } catch (e) { if (!cancelled) setInventoryError(e instanceof Error ? e.message : "Could not load inventory suggestions."); }
      finally { if (!cancelled) setInventoryLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (!medicineBoxRef.current?.contains(target)) setActiveMedicine(null);
      if (!serviceBoxRef.current?.contains(target)) setActiveService(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function update(i: number, key: keyof Item, value: string | number | null) {
    setItems((prev) => prev.map((item, index) => index === i ? { ...item, [key]: value } : item));
  }
  function selectMedicine(i: number, item: InventoryItem) {
    setItems((prev) => prev.map((line, index) => index === i ? { ...line, medicationName: item.name, inventoryItemId: item.id, unitPrice: item.price } : line));
    setMedicineQuery(""); setActiveMedicine(null);
  }
  function addItem() { setItems((prev) => [...prev, { ...EMPTY }]); }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, index) => index !== i)); }
  function addService(item: InventoryItem) {
    if (services.some((service) => service.id === item.id)) { setServiceQuery(""); setActiveService(false); return; }
    setServices((prev) => [...prev, { id: item.id, name: item.name, category: item.category as "test" | "scan", quantity: 1, unitPrice: item.price }]);
    setServiceQuery(""); setActiveService(false);
  }
  function updateService(id: string, quantity: number) { setServices((prev) => prev.map((service) => service.id === id ? { ...service, quantity: Math.max(1, Math.floor(quantity) || 1) } : service)); }
  function removeService(id: string) { setServices((prev) => prev.filter((service) => service.id !== id)); }

  const medicineSuggestions = medicineQuery.trim() ? inventory.filter((item) => item.category === "medicine" && item.name.toLowerCase().includes(medicineQuery.toLowerCase())).slice(0, 8) : [];
  const serviceSuggestions = serviceQuery.trim() ? inventory.filter((item) => (item.category === "test" || item.category === "scan") && item.name.toLowerCase().includes(serviceQuery.toLowerCase()) && !services.some((service) => service.id === item.id)).slice(0, 8) : [];
  const medicineTotal = items.reduce((sum, item) => sum + item.unitPrice * Math.max(1, item.quantity || 1), 0);
  const serviceTotal = services.reduce((sum, service) => sum + service.unitPrice * service.quantity, 0);

  async function save() {
    const valid = items.filter((item) => item.medicationName.trim());
    setSaving(true); setError("");
    try {
      const notesParts = [
        tests.trim() ? `Tests advised: ${tests.trim()}` : "",
        services.length ? `Selected services: ${services.map((service) => `${service.name} [${service.id}] ×${service.quantity} @ ${service.unitPrice}`).join(", ")}` : "",
        advice.trim() ? `Advice: ${advice.trim()}` : "",
        followUp ? `Follow-up date: ${followUp}` : "",
        valid.some((item) => item.inventoryItemId) ? `Inventory medicines: ${valid.filter((item) => item.inventoryItemId).map((item) => `${item.medicationName} [${item.inventoryItemId}] ×${item.quantity} @ ${item.unitPrice}`).join(", ")}` : "",
      ].filter(Boolean);
      const created = await apiSend<{ prescription: { id: string } }>("/api/prescriptions", "POST", {
        action: "create", patientId, visitId: appointmentId, notes: notesParts.join(" | "),
        items: valid.map((item) => ({ medicationName: item.medicationName, dose: item.dose, frequency: item.frequency, duration: item.duration, quantity: String(item.quantity), instructions: item.inventoryItemId ? `Inventory item: ${item.inventoryItemId}; unit price: ${item.unitPrice}` : undefined })),
      });
      await apiSend("/api/prescriptions", "POST", { action: "sign", prescriptionId: created.prescription.id }).catch(() => { });
      setSaved(true); onSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save prescription."); }
    finally { setSaving(false); }
  }

  function print() {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Prescription — ${patientName}</title><style>body{font-family:Georgia,serif;color:#1f2d2b;padding:40px;max-width:720px;margin:auto}h1{color:#07634f;margin:0}.muted{color:#6b7c78;font-size:13px}hr{border:none;border-top:2px solid #07947f;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #dde}th{font-size:12px;text-transform:uppercase;color:#5a7a6e}.rx{font-size:28px;color:#07634f;font-weight:bold}.sec{margin-top:16px}.sec b{color:#07634f}.sign{margin-top:48px;text-align:right}</style></head><body>${html}</body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
    <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-[#eef4f1] px-6 py-4"><h2 className="text-lg font-bold text-[#173f3c]">Prescription letter</h2><button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#8a9e98]" /></button></div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">{error}</div>}
        {saved && <div className="mb-3 rounded-lg border border-[#c2ddd5] bg-[#f0faf5] p-2.5 text-sm text-[#317b67]">Prescription saved &amp; signed. You can print it now.</div>}
        <p className="mb-2 text-[11px] text-[#8a9e98]">Pre-filled from the AI report — review and edit before signing. The clinician is responsible for the final prescription.</p>
        {inventoryLoading && <p className="mb-2 text-xs text-[#5f7c70]">Loading inventory suggestions…</p>}
        {inventoryError && <p className="mb-2 text-xs text-amber-700">Inventory suggestions unavailable: {inventoryError}</p>}
        <p className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Medicines</p>
        <div className="mt-1.5 space-y-2">{items.map((item, i) => {
          const suggestions = activeMedicine === i ? medicineSuggestions : [];
          return <div key={i} ref={i === activeMedicine ? medicineBoxRef : undefined} className="relative flex flex-wrap items-center gap-2 rounded-lg border border-[#e4efe9] bg-[#fbfdfc] p-2">
            <input value={item.medicationName} onChange={(event) => { update(i, "medicationName", event.target.value); update(i, "inventoryItemId", null); setMedicineQuery(event.target.value); setActiveMedicine(i); }} onFocus={() => { setMedicineQuery(item.medicationName); setActiveMedicine(i); }} onKeyDown={(event) => { if (event.key === "Escape") setActiveMedicine(null); if (event.key === "ArrowDown" && suggestions[0]) { event.preventDefault(); selectMedicine(i, suggestions[0]); } }} placeholder="Medicine" className="min-w-[140px] flex-1 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
            {suggestions.length > 0 && <div className="absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[#dce9e3] bg-white shadow-lg">{suggestions.map((suggestion) => <button key={suggestion.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectMedicine(i, suggestion)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#f0f6f3]"><span>{suggestion.name}</span><span className="font-semibold text-[#317b67]">{formatINR(suggestion.price)}</span></button>)}</div>}
            {activeMedicine === i && medicineQuery.trim() && !inventoryLoading && !inventoryError && suggestions.length === 0 && <div className="absolute left-2 right-2 top-full z-20 mt-1 rounded-lg border border-[#dce9e3] bg-white px-3 py-2 text-xs text-[#8a9e98] shadow-lg">No matching medicines.</div>}
            <input value={item.dose} onChange={(event) => update(i, "dose", event.target.value)} placeholder="Dose" className="w-20 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
            <select value={item.frequency} onChange={(event) => update(i, "frequency", event.target.value)} className="rounded border border-[#dce9e3] px-2 py-1 text-xs outline-none">{FREQ.map((frequency) => <option key={frequency}>{frequency}</option>)}</select>
            <input value={item.duration} onChange={(event) => update(i, "duration", event.target.value)} placeholder="Duration" className="w-24 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
            <input type="number" min="1" value={item.quantity} onChange={(event) => update(i, "quantity", Math.max(1, Number(event.target.value) || 1))} aria-label="Medicine quantity" className="w-16 rounded border border-[#dce9e3] px-2 py-1 text-sm outline-none" />
            <span className="w-20 text-right text-xs font-semibold text-[#41627a]">{formatINR(item.unitPrice * Math.max(1, item.quantity))}</span>
            <button onClick={() => removeItem(i)} aria-label="Remove"><Trash2 className="h-4 w-4 text-red-400" /></button>
          </div>;
        })}</div>
        <button onClick={addItem} className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#07947f]"><Plus className="h-3.5 w-3.5" /> Add medicine</button>
        <div className="mt-2 text-right text-xs font-bold text-[#24443f]">Medicine subtotal: {formatINR(medicineTotal)}</div>

        <div className="mt-4" ref={serviceBoxRef}>
          <Field label="Tests advised"><input value={serviceQuery} onChange={(event) => { setServiceQuery(event.target.value); setActiveService(true); }} onFocus={() => setActiveService(true)} onKeyDown={(event) => { if (event.key === "Escape") setActiveService(false); if (event.key === "ArrowDown" && serviceSuggestions[0]) { event.preventDefault(); addService(serviceSuggestions[0]); } }} placeholder="Type to search tests or scans" className="in" /></Field>
          {activeService && serviceQuery.trim() && <div className="relative"><div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-[#dce9e3] bg-white shadow-lg">{serviceSuggestions.length ? serviceSuggestions.map((service) => <button key={service.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addService(service)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#f0f6f3]"><span>{service.name} <span className="text-[#8a9e98]">· {service.category}</span></span><span className="font-semibold text-[#317b67]">{formatINR(service.price)}</span></button>) : <p className="px-3 py-2 text-xs text-[#8a9e98]">No matching tests or scans.</p>}</div></div>}
          <div className="mt-2 space-y-1.5">{services.map((service) => <div key={service.id} className="flex items-center gap-2 rounded-lg border border-[#e4efe9] bg-[#fbfdfc] px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate font-semibold text-[#24443f]">{service.name}<span className="ml-1 font-normal text-[#8a9e98]">({service.category})</span></span><input type="number" min="1" value={service.quantity} onChange={(event) => updateService(service.id, Number(event.target.value))} className="w-14 rounded border border-[#dce9e3] px-2 py-1 text-center" /><span className="w-20 text-right font-semibold text-[#41627a]">{formatINR(service.unitPrice * service.quantity)}</span><button onClick={() => removeService(service.id)} aria-label={`Remove ${service.name}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></button></div>)}</div>
          <textarea value={tests} onChange={(event) => setTests(event.target.value)} rows={2} placeholder="Additional test instructions or free-text advice" className="in mt-2" />
          <div className="mt-2 text-right text-xs font-bold text-[#24443f]">Tests/services total: {formatINR(serviceTotal)}</div>
        </div>
        <div className="mt-4 grid gap-3"><Field label="Advice / instructions"><textarea value={advice} onChange={(event) => setAdvice(event.target.value)} rows={2} placeholder="e.g. Stay hydrated, avoid oily food" className="in" /></Field><Field label="Follow-up date"><input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} className="in" /><span className="mt-1 block text-xs text-[#5f7c70]">{followUp ? `Selected follow-up: ${new Date(`${followUp}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : "Choose a review date"}</span></Field></div>

        <div className="hidden"><div ref={printRef}><h1>AI UPCHAR Clinic</h1><p className="muted">Dr. Ananya Arya · General Medicine · Reg. no. XXXXXX</p><hr /><p><b>Patient:</b> {patientName}{patientMeta ? ` (${patientMeta})` : ""}</p><p className="muted">Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p><p className="rx">℞</p><table><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Qty</th><th>Total</th></tr></thead><tbody>{items.filter((item) => item.medicationName.trim()).map((item, i) => <tr key={i}><td>{item.medicationName}</td><td>{item.dose}</td><td>{item.frequency}</td><td>{item.quantity}</td><td>{formatINR(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table><p className="sec"><b>Medicine subtotal:</b> {formatINR(medicineTotal)}</p>{services.length > 0 && <><p className="sec"><b>Tests &amp; scans:</b></p><table><tbody>{services.map((service) => <tr key={service.id}><td>{service.name} ({service.category})</td><td>{service.quantity}</td><td>{formatINR(service.unitPrice * service.quantity)}</td></tr>)}</tbody></table><p className="sec"><b>Tests/services total:</b> {formatINR(serviceTotal)}</p></>}{tests.trim() && <p className="sec"><b>Additional tests:</b> {tests}</p>}{advice.trim() && <p className="sec"><b>Advice:</b> {advice}</p>}{followUp && <p className="sec"><b>Follow-up date:</b> {new Date(`${followUp}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>}<div className="sign"><p>_______________________<br />Dr. Ananya Arya</p></div></div></div>
      </div>
      <div className="flex items-center justify-between border-t border-[#eef4f1] px-6 py-4"><span className="text-sm text-[#5f7c70]">Total <strong className="ml-1 text-lg text-[#173f3c]">{formatINR(medicineTotal + serviceTotal)}</strong></span><div className="flex gap-2"><button onClick={print} className="flex items-center gap-2 rounded-xl border border-[#dce9e3] px-4 py-2.5 text-sm font-bold text-[#317b67]"><Printer className="h-4 w-4" /> Print</button><button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save &amp; sign</button></div></div>
    </div>
    <style jsx>{`.in{width:100%;border:1px solid #dce9e3;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;outline:none}.in:focus{border-color:#07947f}`}</style>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5a967e]">{label}</span>{children}</label>; }
