"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddMedicineMutation, useAddServiceMutation, useGetMedicinesQuery, useGetServicesQuery, useUpdateMedicineMutation } from "@/lib/apiSlice";
import { inr, Medicine, Service, stockTone, tone } from "./shared";

export default function InventoryView() {
  const [tab, setTab] = useState<"medicines" | "services">("medicines");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab("medicines")} className="rounded-full border px-4 py-2 text-xs font-bold" style={tab === "medicines" ? { borderColor: tone.primary, background: tone.primary, color: "#fff" } : { borderColor: tone.border, color: tone.inkSoft }}>Medicines</button>
        <button onClick={() => setTab("services")} className="rounded-full border px-4 py-2 text-xs font-bold" style={tab === "services" ? { borderColor: tone.primary, background: tone.primary, color: "#fff" } : { borderColor: tone.border, color: tone.inkSoft }}>Tests &amp; Scans</button>
      </div>
      {tab === "medicines" ? <MedicinesPanel /> : <ServicesPanel />}
    </div>
  );
}

function MedicinesPanel() {
  const { data, isLoading } = useGetMedicinesQuery();
  const medicines = data?.medicines ?? [];
  const [addMedicine, { isLoading: adding }] = useAddMedicineMutation();
  const [showAdd, setShowAdd] = useState(false);
  const [stockFor, setStockFor] = useState<Medicine | null>(null);
  const [newMed, setNewMed] = useState({ name: "", unit: "Tablet", purchasePrice: "", salePrice: "", currentStock: "", minStock: "" });
  const [errorText, setErrorText] = useState("");

  async function submitAdd() {
    setErrorText("");
    try {
      await addMedicine({ name: newMed.name, unit: newMed.unit, purchasePrice: Number(newMed.purchasePrice), salePrice: Number(newMed.salePrice), currentStock: Number(newMed.currentStock), minStock: Number(newMed.minStock) }).unwrap();
      setShowAdd(false);
      setNewMed({ name: "", unit: "Tablet", purchasePrice: "", salePrice: "", currentStock: "", minStock: "" });
    } catch (err: unknown) { setErrorText(err instanceof Error ? err.message : "Could not add medicine."); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end"><button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white" style={{ background: tone.primary }}><Plus className="h-4 w-4" /> Add medicine</button></div>

      {showAdd && <div className="mb-4 rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        {errorText && <p className="mb-3 rounded-lg p-2 text-xs" style={{ background: tone.dangerBg, color: tone.danger }}>{errorText}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="Name" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={newMed.unit} onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })} placeholder="Unit (Tablet/Bottle...)" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={newMed.purchasePrice} onChange={(e) => setNewMed({ ...newMed, purchasePrice: e.target.value })} placeholder="Purchase price ₹" type="number" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={newMed.salePrice} onChange={(e) => setNewMed({ ...newMed, salePrice: e.target.value })} placeholder="Sale price ₹" type="number" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={newMed.currentStock} onChange={(e) => setNewMed({ ...newMed, currentStock: e.target.value })} placeholder="Opening stock" type="number" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={newMed.minStock} onChange={(e) => setNewMed({ ...newMed, minStock: e.target.value })} placeholder="Minimum stock" type="number" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
        </div>
        <div className="mt-4 flex gap-2"><button onClick={submitAdd} disabled={adding} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: tone.primary }}>Save</button><button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ color: tone.muted }}>Cancel</button></div>
      </div>}

      {isLoading ? <p className="text-sm" style={{ color: tone.muted }}>Loading medicines…</p> : <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: tone.border }}>
        <table className="w-full text-left text-sm">
          <thead><tr style={{ background: tone.bg, color: tone.muted }}><th className="px-4 py-3 font-semibold">Medicine</th><th className="px-4 py-3 font-semibold">Unit</th><th className="px-4 py-3 font-semibold">Purchase</th><th className="px-4 py-3 font-semibold">Sale</th><th className="px-4 py-3 font-semibold">Stock</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold"></th></tr></thead>
          <tbody>
            {medicines.map((m) => <tr key={m.id} className="border-t" style={{ borderColor: tone.border, background: tone.card }}>
              <td className="px-4 py-3 font-semibold" style={{ color: tone.ink }}>{m.name}</td>
              <td className="px-4 py-3" style={{ color: tone.inkSoft }}>{m.unit}</td>
              <td className="px-4 py-3" style={{ color: tone.inkSoft }}>{inr(m.purchasePrice)}</td>
              <td className="px-4 py-3" style={{ color: tone.inkSoft }}>{inr(m.salePrice)}</td>
              <td className="px-4 py-3" style={{ color: tone.inkSoft }}>{m.currentStock} (min {m.minStock})</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${stockTone[m.status]}`}>{m.status}</span></td>
              <td className="px-4 py-3"><button onClick={() => setStockFor(m)} className="text-xs font-bold hover:underline" style={{ color: tone.primary }}>Adjust stock</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

      {stockFor && <StockDialog medicine={stockFor} onClose={() => setStockFor(null)} />}
    </div>
  );
}

function StockDialog({ medicine, onClose }: { medicine: Medicine; onClose: () => void }) {
  const [updateMedicine, { isLoading: saving }] = useUpdateMedicineMutation();
  const [type, setType] = useState<"in" | "out" | "return" | "adjustment">("in");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [errorText, setErrorText] = useState("");

  async function submit() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setErrorText("Enter a quantity greater than 0."); return; }
    setErrorText("");
    try {
      await updateMedicine({ id: medicine.id, action: "stock", type, quantity: qty, note }).unwrap();
      onClose();
    } catch (err: unknown) { setErrorText(err instanceof Error ? err.message : "Stock update failed."); }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,63,60,0.3)" }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold" style={{ color: tone.ink }}>Stock movement — {medicine.name}</h3>
        <p className="mt-1 text-xs" style={{ color: tone.muted }}>Current stock: {medicine.currentStock} {medicine.unit}(s)</p>
        {errorText && <p className="mt-3 rounded-lg p-2 text-xs" style={{ background: tone.dangerBg, color: tone.danger }}>{errorText}</p>}
        <div className="mt-4 grid gap-3">
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }}>
            <option value="in">Stock in (received)</option>
            <option value="out">Stock out (dispensed/sold)</option>
            <option value="return">Return</option>
            <option value="adjustment">Adjustment (correction)</option>
          </select>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" placeholder="Quantity" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
        </div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ color: tone.muted }}>Cancel</button><button onClick={submit} disabled={saving} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: tone.primary }}>{saving ? "Saving…" : "Apply"}</button></div>
      </div>
    </div>
  );
}

function ServicesPanel() {
  const { data, isLoading } = useGetServicesQuery();
  const services = data?.services ?? [];
  const [addService, { isLoading: adding }] = useAddServiceMutation();
  const [showAdd, setShowAdd] = useState(false);
  const [newSvc, setNewSvc] = useState({ name: "", category: "Test" as Service["category"], price: "" });
  const [errorText, setErrorText] = useState("");

  async function submitAdd() {
    setErrorText("");
    try {
      await addService({ name: newSvc.name, category: newSvc.category, price: Number(newSvc.price) }).unwrap();
      setShowAdd(false);
      setNewSvc({ name: "", category: "Test", price: "" });
    } catch (err: unknown) { setErrorText(err instanceof Error ? err.message : "Could not add service."); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end"><button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white" style={{ background: tone.primary }}><Plus className="h-4 w-4" /> Add test / scan</button></div>
      {showAdd && <div className="mb-4 rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        {errorText && <p className="mb-3 rounded-lg p-2 text-xs" style={{ background: tone.dangerBg, color: tone.danger }}>{errorText}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={newSvc.name} onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })} placeholder="Name" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <select value={newSvc.category} onChange={(e) => setNewSvc({ ...newSvc, category: e.target.value as Service["category"] })} className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }}>
            <option value="Test">Test</option><option value="Scan">Scan</option><option value="Procedure">Procedure</option>
          </select>
          <input value={newSvc.price} onChange={(e) => setNewSvc({ ...newSvc, price: e.target.value })} type="number" placeholder="Price ₹" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
        </div>
        <div className="mt-4 flex gap-2"><button onClick={submitAdd} disabled={adding} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: tone.primary }}>Save</button><button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ color: tone.muted }}>Cancel</button></div>
      </div>}
      {isLoading ? <p className="text-sm" style={{ color: tone.muted }}>Loading catalogue…</p> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => <div key={s.id} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: tone.border, background: tone.card }}>
          <div><p className="font-semibold" style={{ color: tone.ink }}>{s.name}</p><p className="text-xs" style={{ color: tone.muted }}>{s.category}</p></div>
          <span className="font-bold" style={{ color: tone.ink }}>{inr(s.price)}</span>
        </div>)}
      </div>}
    </div>
  );
}
