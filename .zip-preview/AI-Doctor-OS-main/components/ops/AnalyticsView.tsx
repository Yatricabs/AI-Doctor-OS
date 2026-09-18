"use client";

import { useGetAppointmentsQuery, useGetBillingQuery, useGetMedicinesQuery, useGetPatientsQuery } from "@/lib/apiSlice";
import { inr, tone } from "./shared";

export default function AnalyticsView() {
  const { data: patientsData, isLoading: patientsLoading } = useGetPatientsQuery();
  const { data: appointmentsData, isLoading: appointmentsLoading } = useGetAppointmentsQuery();
  const { data: billingData, isLoading: billingLoading } = useGetBillingQuery();
  const { data: medicinesData, isLoading: medicinesLoading } = useGetMedicinesQuery();

  const loading = patientsLoading || appointmentsLoading || billingLoading || medicinesLoading;
  if (loading) return <p className="text-sm" style={{ color: tone.muted }}>Crunching the numbers…</p>;

  const patients = patientsData?.patients ?? [];
  const appointments = appointmentsData?.appointments ?? [];
  const transactions = billingData?.transactions ?? [];
  const medicines = medicinesData?.medicines ?? [];

  const newCount = appointments.filter((a) => a.visitType === "New").length;
  const followUpCount = appointments.filter((a) => a.visitType === "Follow-up").length;
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const revenueByType = ["Consultation fee", "Medicine", "Test", "Scan", "Procedure"].map((type) => ({ type, amount: transactions.filter((tx) => tx.type === type).reduce((s, tx) => s + tx.amount, 0) }));
  const inventoryValue = medicines.reduce((sum, m) => sum + m.purchasePrice * m.currentStock, 0);
  const lowStock = medicines.filter((m) => m.status !== "In stock").length;
  const avgRevenuePerPatient = patients.length > 0 ? totalRevenue / patients.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total patients" value={String(patients.length)} />
        <Metric label="Total appointments" value={String(appointments.length)} detail={`${newCount} new · ${followUpCount} follow-up`} />
        <Metric label="Total revenue (all-time)" value={inr(totalRevenue)} />
        <Metric label="Avg. revenue / patient" value={inr(Math.round(avgRevenuePerPatient))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
          <h3 className="text-sm font-bold" style={{ color: tone.ink }}>Revenue by category</h3>
          <div className="mt-4 space-y-3">{revenueByType.map((r) => <div key={r.type}><div className="flex justify-between text-xs"><span style={{ color: tone.inkSoft }}>{r.type}</span><span className="font-bold" style={{ color: tone.ink }}>{inr(r.amount)}</span></div><div className="mt-1 h-2 rounded-full" style={{ background: tone.bg }}><div className="h-full rounded-full" style={{ width: totalRevenue > 0 ? `${(r.amount / totalRevenue) * 100}%` : "0%", background: tone.primary }} /></div></div>)}</div>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
          <h3 className="text-sm font-bold" style={{ color: tone.ink }}>Inventory</h3>
          <p className="mt-3 text-2xl font-bold" style={{ color: tone.ink }}>{inr(inventoryValue)}</p>
          <p className="text-xs" style={{ color: tone.muted }}>Total stock value at purchase price</p>
          <p className="mt-3 text-sm" style={{ color: lowStock > 0 ? tone.danger : tone.success }}>{lowStock} medicine(s) at or below minimum stock</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: tone.border, background: tone.card }}>
      <p className="text-xs" style={{ color: tone.muted }}>{label}</p>
      <p className="mt-1 text-xl font-bold" style={{ color: tone.ink }}>{value}</p>
      {detail && <p className="text-[11px]" style={{ color: tone.muted }}>{detail}</p>}
    </div>
  );
}
