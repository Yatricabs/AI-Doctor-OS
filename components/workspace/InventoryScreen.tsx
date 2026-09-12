"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiGet, apiSend } from "./api";
import { formatINR } from "@/lib/format";

type Category = "medicine" | "test" | "scan";
type Item = {
  id: string;
  name: string;
  category: Category;
  unit?: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  tracksStock: boolean;
  lowStock: boolean;
};

const CATS: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "medicine", label: "Medicines" },
  { key: "test", label: "Tests" },
  { key: "scan", label: "Scans" },
];

const EMPTY = { name: "", category: "medicine" as Category, unit: "", price: "", stockQty: "", lowStockThreshold: "10" };

export default function InventoryScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [cat, setCat] = useState<Category | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiGet<{ items: Item[] }>("/api/inventory");
      setItems(data.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load inventory."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = items.filter((i) => cat === "all" || i.category === cat);
  const lowCount = items.filter((i) => i.lowStock).length;

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, category: cat === "all" ? "medicine" : cat });
    setShowForm(true);
  }
  function openEdit(it: Item) {
    setEditing(it);
    setForm({
      name: it.name, category: it.category, unit: it.unit ?? "",
      price: String(it.price), stockQty: String(it.stockQty), lowStockThreshold: String(it.lowStockThreshold),
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (form.price === "" || Number(form.price) < 0) { setError("Enter a valid price."); return; }
    setSaving(true); setError("");
    try {
      if (editing) {
        await apiSend("/api/inventory", "PATCH", {
          id: editing.id, name: form.name, unit: form.unit, price: Number(form.price),
          stockQty: Number(form.stockQty || 0), lowStockThreshold: Number(form.lowStockThreshold || 0),
        });
      } else {
        await apiSend("/api/inventory", "POST", {
          name: form.name, category: form.category, unit: form.unit, price: Number(form.price),
          stockQty: Number(form.stockQty || 0), lowStockThreshold: Number(form.lowStockThreshold || 10),
        });
      }
      setShowForm(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function remove(it: Item) {
    if (!confirm(`Remove "${it.name}" from inventory?`)) return;
    try { await apiSend(`/api/inventory?id=${encodeURIComponent(it.id)}`, "DELETE"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Inventory</h1>
          <p className="mt-1 text-sm text-[#78908a]">Medicines, tests and scans with prices (INR) and stock.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#066d66]">
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      {lowCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {lowCount} item{lowCount > 1 ? "s" : ""} low on stock.
        </div>
      )}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${cat === c.key ? "bg-[#153f3c] text-white" : "border border-[#dce9e3] text-[#5a7a6e] hover:bg-[#f0f6f3]"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…</div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e1e9e5] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eef4f1] bg-[#f7fbf9] text-left text-[11px] font-bold uppercase tracking-wide text-[#5a967e]">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it) => (
                <tr key={it.id} className="border-b border-[#f2f6f4] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#24443f]">{it.name}</p>
                    {it.unit && <p className="text-[11px] text-[#8a9e98]">per {it.unit}</p>}
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#eef7f2] px-2 py-0.5 text-[11px] font-semibold capitalize text-[#4f9d78]">{it.category}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-[#24443f]">{formatINR(it.price)}</td>
                  <td className="px-4 py-3 text-right">
                    {it.tracksStock ? (
                      <span className={`font-semibold ${it.lowStock ? "text-red-600" : "text-[#24443f]"}`}>{it.stockQty}{it.lowStock ? " ⚠" : ""}</span>
                    ) : (
                      <span className="text-[11px] text-[#9db3aa]">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(it)} aria-label="Edit" className="rounded-lg border border-[#dce9e3] p-1.5 text-[#5a967e] hover:bg-[#f0f6f3]"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => void remove(it)} aria-label="Delete" className="rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#8a9e98]"><Package className="mx-auto mb-2 h-6 w-6 text-[#c2ddd5]" />No items in this category.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#173f3c]">{editing ? "Edit item" : "Add item"}</h2>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X className="h-5 w-5 text-[#8a9e98]" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Paracetamol 500mg" /></Field>
              {!editing && (
                <Field label="Category">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} className="input">
                    <option value="medicine">Medicine</option>
                    <option value="test">Test</option>
                    <option value="scan">Scan</option>
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (₹)"><input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" /></Field>
                <Field label="Unit"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" placeholder="tablet / test" /></Field>
              </div>
              {(editing ? editing.tracksStock : form.category === "medicine") && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Stock qty"><input type="number" min="0" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} className="input" /></Field>
                  <Field label="Low-stock alert at"><input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="input" /></Field>
                </div>
              )}
            </div>
            <button onClick={() => void save()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {editing ? "Save changes" : "Add to inventory"}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .input { width: 100%; border: 1px solid #dce9e3; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #07947f; }
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
