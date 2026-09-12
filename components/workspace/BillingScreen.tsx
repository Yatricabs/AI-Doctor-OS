"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Receipt, Trash2, X } from "lucide-react";
import { apiGet, apiSend } from "./api";
import { formatINR, humanize } from "@/lib/format";

type BillItem = { id: string; itemType: string; description: string; quantity: number; unitPrice: number; amount: number };
type Bill = { id: string; patientId: string; patientName?: string; total: number; createdAt: string; items: BillItem[] };
type PerPatient = { patientId: string; patientName: string; total: number; bills: number };
type BillingData = { bills: Bill[]; perPatient: PerPatient[]; breakdown: Record<string, number>; grandTotal: number };

type Patient = { id: string; name: string };
type InvItem = { id: string; name: string; category: "medicine" | "test" | "scan"; price: number; stockQty: number; tracksStock: boolean };
type Line = { key: string; inventoryItemId: string | null; itemType: string; description: string; quantity: number; unitPrice: number };

const BREAKDOWN_LABELS: Record<string, string> = { appointment: "Consultation fees", medicine: "Medicine sales", test: "Tests", scan: "Scans" };

export default function BillingScreen() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiGet<BillingData>("/api/billing")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load billing."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Billing</h1>
          <p className="mt-1 text-sm text-[#78908a]">Earnings from consultations, medicines, tests and scans (INR).</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#066d66]">
          <Plus className="h-4 w-4" /> New bill
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading billing…</div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#c2ddd5] bg-[#0e4a45] p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#8bd4be]">Total earnings</p>
              <p className="mt-1 text-2xl font-bold">{formatINR(data.grandTotal)}</p>
            </div>
            {(["appointment", "medicine", "test", "scan"] as const).map((k) => (
              <div key={k} className="rounded-2xl border border-[#e1e9e5] bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#5a967e]">{BREAKDOWN_LABELS[k]}</p>
                <p className="mt-1 text-xl font-bold text-[#173f3c]">{formatINR(data.breakdown[k] ?? 0)}</p>
              </div>
            ))}
          </div>

          {/* Per-patient earnings */}
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-[#5a967e]">Earnings by patient</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#e1e9e5] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eef4f1] bg-[#f7fbf9] text-left text-[11px] font-bold uppercase tracking-wide text-[#5a967e]">
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.perPatient.map((p) => (
                  <tr key={p.patientId} className="border-b border-[#f2f6f4] last:border-0">
                    <td className="px-4 py-3"><p className="font-semibold text-[#24443f]">{p.patientName}</p><p className="text-[11px] text-[#8a9e98]">{p.patientId}</p></td>
                    <td className="px-4 py-3 text-right text-[#5f7c70]">{p.bills}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#24443f]">{formatINR(p.total)}</td>
                  </tr>
                ))}
                {data.perPatient.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#8a9e98]">No bills yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Recent bills (itemized) */}
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-[#5a967e]">Recent bills</h2>
          <div className="mt-3 space-y-2">
            {data.bills.map((b) => (
              <div key={b.id} className="rounded-xl border border-[#e1e9e5] bg-white">
                <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#f7faf8]">
                  <span className="flex items-center gap-2 text-sm">
                    <Receipt className="h-4 w-4 text-[#07947f]" />
                    <span className="font-semibold text-[#24443f]">{b.patientName ?? b.patientId}</span>
                    <span className="text-[11px] text-[#8a9e98]">{b.createdAt?.slice(0, 10)}</span>
                  </span>
                  <span className="font-bold text-[#24443f]">{formatINR(b.total)}</span>
                </button>
                {expanded === b.id && (
                  <div className="border-t border-[#f0f4f2] px-4 py-2.5">
                    {b.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="text-[#5f7c70]">{it.description} <span className="text-[#9db3aa]">×{it.quantity} · {humanize(it.itemType)}</span></span>
                        <span className="font-semibold text-[#41627a]">{formatINR(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {data.bills.length === 0 && <p className="rounded-xl border border-[#e1e9e5] bg-white px-4 py-8 text-center text-sm text-[#8a9e98]">No bills yet.</p>}
          </div>
        </>
      ) : null}

      {showForm && <NewBillModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} />}
    </div>
  );
}

function NewBillModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [patientId, setPatientId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: "fee", inventoryItemId: null, itemType: "appointment", description: "Consultation fee", quantity: 1, unitPrice: 500 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [p, inv] = await Promise.all([
          apiGet<{ patients: Patient[] }>("/api/patients"),
          apiGet<{ items: InvItem[] }>("/api/inventory"),
        ]);
        setPatients(p.patients);
        setInventory(inv.items);
        if (p.patients[0]) setPatientId(p.patients[0].id);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load form data."); }
    })();
  }, []);

  function addLine(inv: InvItem) {
    setLines((ls) => [...ls, { key: `${inv.id}-${Date.now()}`, inventoryItemId: inv.id, itemType: inv.category, description: inv.name, quantity: 1, unitPrice: inv.price }]);
  }
  function updateQty(key: string, qty: number) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, qty) } : l)));
  }
  function removeLine(key: string) { setLines((ls) => ls.filter((l) => l.key !== key)); }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  async function save() {
    if (!patientId) { setError("Select a patient."); return; }
    if (lines.length === 0) { setError("Add at least one item."); return; }
    setSaving(true); setError("");
    try {
      await apiSend("/api/billing", "POST", {
        patientId,
        items: lines.map((l) => ({ inventoryItemId: l.inventoryItemId, itemType: l.itemType, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create bill."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#eef4f1] px-6 py-4">
          <h2 className="text-lg font-bold text-[#173f3c]">New bill</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#8a9e98]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">{error}</div>}

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5a967e]">Patient</span>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]">
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </label>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5a967e]">Bill items</p>
            <div className="space-y-1.5">
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2 rounded-lg border border-[#e4efe9] bg-[#fbfdfc] px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#24443f]">{l.description}</p>
                    <p className="text-[11px] text-[#8a9e98]">{humanize(l.itemType)} · {formatINR(l.unitPrice)}</p>
                  </div>
                  <input type="number" min="1" value={l.quantity} onChange={(e) => updateQty(l.key, Number(e.target.value))} className="w-14 rounded border border-[#dce9e3] px-2 py-1 text-center text-xs" />
                  <span className="w-16 text-right font-semibold text-[#41627a]">{formatINR(l.quantity * l.unitPrice)}</span>
                  {l.itemType !== "appointment" && <button onClick={() => removeLine(l.key)} aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5a967e]">Add from inventory</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#eef4f1] p-2">
              {inventory.map((inv) => (
                <button key={inv.id} onClick={() => addLine(inv)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-[#f0f6f3]">
                  <span className="truncate text-[#41627a]">{inv.name} <span className="text-[#9db3aa]">· {inv.category}{inv.tracksStock ? ` · stock ${inv.stockQty}` : ""}</span></span>
                  <span className="ml-2 shrink-0 font-semibold text-[#317b67]">{formatINR(inv.price)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#eef4f1] px-6 py-4">
          <span className="text-sm text-[#5f7c70]">Total <strong className="ml-1 text-lg text-[#173f3c]">{formatINR(total)}</strong></span>
          <button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create bill
          </button>
        </div>
      </div>
    </div>
  );
}
