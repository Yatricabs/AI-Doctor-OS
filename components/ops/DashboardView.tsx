"use client";

import { CalendarClock, IndianRupee, PackageSearch, Plus, Users } from "lucide-react";
import { useGetDashboardSummaryQuery } from "@/lib/apiSlice";
import { inr, todayISO, tone } from "./shared";

export default function DashboardView({ navigate }: { navigate: (section: string) => void }) {
  const { data, isLoading, isError } = useGetDashboardSummaryQuery({ date: todayISO() });
  const summary = data?.summary;

  if (isLoading) return <p className="text-sm" style={{ color: tone.muted }}>Loading today&apos;s overview…</p>;
  if (isError || !summary) return <p className="text-sm" style={{ color: tone.danger }}>Could not load the dashboard.</p>;

  const hours = Math.floor(summary.appointments.estimatedMinutes / 60);
  const minutes = summary.appointments.estimatedMinutes % 60;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        <div><h2 className="text-lg font-bold" style={{ color: tone.ink }}>Create an appointment</h2><p className="mt-1 text-sm" style={{ color: tone.muted }}>Start the new-patient intake directly from the dashboard.</p></div>
        <button onClick={() => navigate("Appointments:new")} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: tone.primary }}><Plus className="h-4 w-4" /> New appointment</button>
      </div>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarClock} label="Appointments today" value={String(summary.appointments.total)} detail={`${summary.appointments.new} new · ${summary.appointments.followUp} follow-up`} onClick={() => navigate("Appointments")} />
        <StatCard icon={CalendarClock} label="Estimated clinic time" value={`${hours}h ${minutes}m`} detail={summary.appointments.urgent > 0 ? `${summary.appointments.urgent} urgent case(s) today` : "No urgent cases flagged"} variant={summary.appointments.urgent > 0 ? "danger" : undefined} />
        <StatCard icon={IndianRupee} label="Revenue today" value={inr(summary.revenue.today)} detail={summary.revenue.byType.filter((r) => r.amount > 0).map((r) => `${r.type}: ${inr(r.amount)}`).join(" · ") || "No transactions yet"} onClick={() => navigate("Billing")} />
        <StatCard icon={Users} label="Total patients on file" value={String(summary.patients.total)} detail="Across all visit types" onClick={() => navigate("Patients")} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold" style={{ color: tone.ink }}>Today&apos;s schedule breakdown</h3><button onClick={() => navigate("Appointments")} className="text-xs font-bold hover:underline" style={{ color: tone.primary }}>Open schedule →</button></div>
          <div className="mt-4 space-y-3">
            <BreakdownBar label="New patients" value={summary.appointments.new} total={summary.appointments.total} color={tone.info} />
            <BreakdownBar label="Follow-ups" value={summary.appointments.followUp} total={summary.appointments.total} color={tone.accentGold} />
            <BreakdownBar label="Urgent priority" value={summary.appointments.urgent} total={summary.appointments.total} color={tone.danger} />
          </div>
          <p className="mt-4 text-xs" style={{ color: tone.muted }}>New visits estimated ~20 min, follow-ups ~10 min — illustrative averages, not a fixed rule.</p>
        </div>

        <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: tone.ink }}><PackageSearch className="h-4 w-4" /> Inventory needing attention</h3><button onClick={() => navigate("Inventory")} className="text-xs font-bold hover:underline" style={{ color: tone.primary }}>Open inventory →</button></div>
          {summary.inventory.lowStockCount === 0 ? <p className="mt-4 text-sm" style={{ color: tone.success }}>All medicines are stocked above their minimum level.</p> : <div className="mt-4 space-y-2">
            {summary.inventory.lowStock.map((med) => <div key={med.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: tone.bg }}><span style={{ color: tone.ink }}>{med.name}</span><span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: med.status === "Out of stock" ? tone.dangerBg : tone.accentGoldBg, color: med.status === "Out of stock" ? tone.danger : tone.accentGold }}>{med.status} · {med.currentStock} {med.unit}(s)</span></div>)}
            {summary.inventory.lowStockCount > summary.inventory.lowStock.length && <p className="text-xs" style={{ color: tone.muted }}>+{summary.inventory.lowStockCount - summary.inventory.lowStock.length} more</p>}
          </div>}
        </div>
      </section>

      {summary.alerts.openCount > 0 && <section className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        <h3 className="text-sm font-bold" style={{ color: tone.ink }}>Needs attention ({summary.alerts.openCount})</h3>
        <div className="mt-3 space-y-2">
          {summary.alerts.items.map((item) => <div key={item.id} className="rounded-lg px-3 py-2 text-sm" style={{ background: tone.dangerBg }}><p className="font-semibold" style={{ color: tone.danger }}>{item.title}</p><p className="mt-0.5 text-xs" style={{ color: tone.inkSoft }}>{item.detail}</p></div>)}
        </div>
      </section>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, onClick, variant }: { icon: typeof Users; label: string; value: string; detail: string; onClick?: () => void; variant?: "danger" }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="rounded-2xl border p-5 text-left transition disabled:cursor-default" style={{ borderColor: tone.border, background: tone.card }}>
      <div className="flex items-start justify-between"><p className="text-xs font-semibold" style={{ color: tone.muted }}>{label}</p><span className="rounded-lg p-2" style={{ background: tone.successBg, color: tone.success }}><Icon className="h-4 w-4" /></span></div>
      <p className="mt-3 text-2xl font-bold" style={{ color: variant === "danger" ? tone.danger : tone.ink }}>{value}</p>
      <p className="mt-1 text-xs" style={{ color: tone.muted }}>{detail}</p>
    </button>
  );
}

function BreakdownBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span style={{ color: tone.inkSoft }}>{label}</span><span className="font-bold" style={{ color: tone.ink }}>{value}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: tone.bg }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
