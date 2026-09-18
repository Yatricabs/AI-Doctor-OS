"use client";

import { useGetBillingQuery } from "@/lib/apiSlice";
import { inr, tone } from "./shared";

const TYPES = ["Consultation fee", "Medicine", "Test", "Scan", "Procedure"] as const;

export default function BillingView({ openPatient }: { openPatient: (patientId: string) => void }) {
  const { data, isLoading } = useGetBillingQuery();
  const transactions = data?.transactions ?? [];

  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const byType = TYPES.map((type) => ({ type, amount: transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0), count: transactions.filter((tx) => tx.type === type).length }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border p-4" style={{ borderColor: tone.border, background: tone.card }}><p className="text-xs" style={{ color: tone.muted }}>Total revenue</p><p className="mt-1 text-xl font-bold" style={{ color: tone.ink }}>{inr(total)}</p></div>
        {byType.map((t) => <div key={t.type} className="rounded-2xl border p-4" style={{ borderColor: tone.border, background: tone.card }}><p className="text-xs" style={{ color: tone.muted }}>{t.type}</p><p className="mt-1 text-xl font-bold" style={{ color: tone.ink }}>{inr(t.amount)}</p><p className="text-[11px]" style={{ color: tone.muted }}>{t.count} transaction(s)</p></div>)}
      </div>

      {isLoading ? <p className="text-sm" style={{ color: tone.muted }}>Loading transactions…</p> : <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: tone.border }}>
        <table className="w-full text-left text-sm">
          <thead><tr style={{ background: tone.bg, color: tone.muted }}><th className="px-4 py-3 font-semibold">Patient</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {transactions.map((tx) => <tr key={tx.id} className="border-t" style={{ borderColor: tone.border, background: tone.card }}>
              <td className="px-4 py-3"><button onClick={() => openPatient(tx.patientId)} className="font-semibold hover:underline" style={{ color: tone.ink }}>{tx.patientName}</button></td>
              <td className="px-4 py-3" style={{ color: tone.inkSoft }}>{tx.type}</td>
              <td className="px-4 py-3" style={{ color: tone.inkSoft }}>{tx.description}</td>
              <td className="px-4 py-3" style={{ color: tone.muted }}>{tx.date}</td>
              <td className="px-4 py-3 text-right font-bold" style={{ color: tone.ink }}>{inr(tx.amount)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
