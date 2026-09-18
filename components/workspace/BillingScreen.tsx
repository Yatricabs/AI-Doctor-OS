"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet } from "./api";
import { formatINR } from "@/lib/format";

type BillItem = { id: string; itemType: string; description: string; amount: number };
type Bill = { id: string; patientId: string; patientName?: string; createdAt: string; items: BillItem[] };
type BillingData = { bills: Bill[] };
const TYPES = ["Consultation fee", "Medicine", "Test", "Scan", "Procedure"] as const;
type BillingType = (typeof TYPES)[number];
type BillingTransaction = { id: string; patientId: string; patientName: string; type: BillingType; description: string; amount: number; date: string };

function billingType(itemType: string): BillingType {
  const labels: Record<string, BillingType> = { appointment: "Consultation fee", medicine: "Medicine", test: "Test", scan: "Scan", procedure: "Procedure" };
  return labels[itemType] ?? "Consultation fee";
}

// ZIP BillingView structure, powered by the target's real, itemized bill API.
export default function BillingScreen({ onOpenPatient }: { onOpenPatient: (patientId: string) => void }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiGet<BillingData>("/api/billing")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load billing transactions."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const transactions = useMemo<BillingTransaction[]>(() => (data?.bills ?? []).flatMap((bill) => bill.items.map((item) => ({
    id: item.id, patientId: bill.patientId, patientName: bill.patientName ?? bill.patientId,
    type: billingType(item.itemType), description: item.description, amount: item.amount,
    date: bill.createdAt?.slice(0, 10) ?? "",
  }))).sort((a, b) => b.date.localeCompare(a.date)), [data]);

  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const byType = TYPES.map((type) => {
    const matching = transactions.filter((transaction) => transaction.type === type);
    return { type, amount: matching.reduce((sum, transaction) => sum + transaction.amount, 0), count: matching.length };
  });

  return <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-6 sm:px-5 md:px-10 md:pt-8">
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Billing</h1>
      <p className="mt-1 text-sm text-[#78908a]">Revenue and every billing transaction, linked to patients and appointments.</p>
    </header>

    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

    {loading ? <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading transactions…</div> : <>
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Total revenue" amount={total} />
        {byType.map((entry) => <MetricCard key={entry.type} label={entry.type} amount={entry.amount} detail={`${entry.count} transaction${entry.count === 1 ? "" : "s"}`} />)}
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-[#e1e9e5] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="bg-[#f7faf8] text-[#78908a]"><th className="px-4 py-3 font-semibold">Patient</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {transactions.map((transaction) => <tr key={transaction.id} className="border-t border-[#e1e9e5] bg-white">
              <td className="px-4 py-3"><button onClick={() => onOpenPatient(transaction.patientId)} className="font-semibold text-[#173f3c] hover:underline">{transaction.patientName}</button></td>
              <td className="px-4 py-3 text-[#5f7c70]">{transaction.type}</td>
              <td className="px-4 py-3 text-[#5f7c70]">{transaction.description}</td>
              <td className="px-4 py-3 text-[#78908a]">{transaction.date}</td>
              <td className="px-4 py-3 text-right font-bold text-[#173f3c]">{formatINR(transaction.amount)}</td>
            </tr>)}
            {transactions.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#78908a]">No billing transactions yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </>}
  </div>;
}

function MetricCard({ label, amount, detail }: { label: string; amount: number; detail?: string }) {
  return <div className="rounded-2xl border border-[#e1e9e5] bg-white p-4"><p className="text-xs text-[#78908a]">{label}</p><p className="mt-1 text-xl font-bold text-[#173f3c]">{formatINR(amount)}</p>{detail && <p className="text-[11px] text-[#78908a]">{detail}</p>}</div>;
}
