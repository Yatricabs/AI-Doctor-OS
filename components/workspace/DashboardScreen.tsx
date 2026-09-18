"use client";

import { useEffect, useState, type ComponentType } from "react";
import { CalendarClock, IndianRupee, Loader2, PackageSearch, Users } from "lucide-react";
import { apiGet } from "./api";
import { formatINR } from "@/lib/format";

type Appointment = { id: string; visitType: string; reason?: string; appointmentDate: string };
type InventoryItem = { id: string; name: string; unit?: string; stockQty: number; lowStock: boolean; tracksStock: boolean };
type InboxItem = { id: string; title: string; detail: string; status: string };
type RevenueSummary = { today: { total: number; bills: number }; breakdown: Record<string, number> };
type DashboardData = { appointments: Appointment[]; patientTotal: number; inventory: InventoryItem[]; revenue: RevenueSummary | null; alerts: InboxItem[] };

const FOLLOW_UP_TYPES = new Set(["follow_up", "report_review", "wellness"]);
const emergencyTerms = /chest pain|shortness of breath|breathless|severe bleeding|unconscious|fainting|stroke|seizure/i;

// ZIP-dashboard structure, powered by the GitHub checkout's existing APIs.
export default function DashboardScreen({ onGoto }: { onGoto: (nav: string, patientId?: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setError("");
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [appointments, patients, inventory, revenue, inbox] = await Promise.all([
          apiGet<{ appointments: Appointment[] }>(`/api/appointments?date=${today}`).catch(() => ({ appointments: [] })),
          apiGet<{ patients: unknown[]; total: number }>("/api/patients").catch(() => ({ patients: [], total: 0 })),
          apiGet<{ items: InventoryItem[] }>("/api/inventory").catch(() => ({ items: [] })),
          apiGet<RevenueSummary>("/api/billing?summary=1").catch(() => null),
          apiGet<{ items: InboxItem[] }>("/api/inbox").catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setData({
          appointments: appointments.appointments,
          patientTotal: patients.total,
          inventory: inventory.items,
          revenue,
          alerts: inbox.items.filter((item) => item.status === "open"),
        });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load the dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const appointments = data?.appointments ?? [];
  const followUps = appointments.filter((appointment) => FOLLOW_UP_TYPES.has(appointment.visitType));
  const newPatients = appointments.length - followUps.length;
  const urgent = appointments.filter((appointment) => emergencyTerms.test(appointment.reason ?? ""));
  const estimatedMinutes = newPatients * 20 + followUps.length * 10;
  const lowStock = (data?.inventory ?? []).filter((item) => item.tracksStock && item.lowStock);
  const hours = Math.floor(estimatedMinutes / 60);
  const minutes = estimatedMinutes % 60;

  return <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-6 sm:px-5 md:px-10 md:pt-8">
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Dashboard</h1>
      <p className="mt-1 text-sm text-[#78908a]">Today&apos;s schedule, revenue, and what needs attention.</p>
    </header>

    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

    {loading ? <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading today&apos;s overview…</div> : <>
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarClock} label="Appointments today" value={String(appointments.length)} detail={`${newPatients} new · ${followUps.length} follow-up`} onClick={() => onGoto("Appointments")} />
        <StatCard icon={CalendarClock} label="Estimated clinic time" value={`${hours}h ${minutes}m`} detail={urgent.length > 0 ? `${urgent.length} urgent case(s) today` : "No urgent cases flagged"} variant={urgent.length > 0 ? "danger" : undefined} />
        <StatCard icon={IndianRupee} label="Revenue today" value={formatINR(data?.revenue?.today.total ?? 0)} detail={Object.entries(data?.revenue?.breakdown ?? {}).filter(([, amount]) => amount > 0).map(([type, amount]) => `${type}: ${formatINR(amount)}`).join(" · ") || "No transactions yet"} onClick={() => onGoto("Billing")} />
        <StatCard icon={Users} label="Total patients on file" value={String(data?.patientTotal ?? 0)} detail="Across all visit types" onClick={() => onGoto("Patients")} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-[#173f3c]">Today&apos;s schedule breakdown</h2><button onClick={() => onGoto("Appointments")} className="text-xs font-bold text-[#07947f] hover:underline">Open schedule →</button></div>
          <div className="mt-4 space-y-3">
            <BreakdownBar label="New patients" value={newPatients} total={appointments.length} color="#6682a5" />
            <BreakdownBar label="Follow-ups" value={followUps.length} total={appointments.length} color="#a17a2d" />
            <BreakdownBar label="Urgent priority" value={urgent.length} total={appointments.length} color="#b3544a" />
          </div>
          <p className="mt-4 text-xs text-[#78908a]">New visits estimated ~20 min, follow-ups ~10 min — illustrative averages, not a fixed rule.</p>
        </div>

        <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-[#173f3c]"><PackageSearch className="h-4 w-4" /> Inventory needing attention</h2><button onClick={() => onGoto("Inventory")} className="text-xs font-bold text-[#07947f] hover:underline">Open inventory →</button></div>
          {lowStock.length === 0 ? <p className="mt-4 text-sm text-[#4f9d78]">All medicines are stocked above their minimum level.</p> : <div className="mt-4 space-y-2">{lowStock.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f7faf8] px-3 py-2 text-sm"><span className="text-[#173f3c]">{item.name}</span><span className="rounded-full bg-[#f6efdd] px-2 py-0.5 text-[10px] font-bold uppercase text-[#a17a2d]">Low stock · {item.stockQty} {item.unit ?? "unit"}(s)</span></div>)}{lowStock.length > 4 && <p className="text-xs text-[#78908a]">+{lowStock.length - 4} more</p>}</div>}
        </div>
      </section>

      {(data?.alerts.length ?? 0) > 0 && <section className="mt-6 rounded-2xl border border-[#e1e9e5] bg-white p-5"><h2 className="text-sm font-bold text-[#173f3c]">Needs attention ({data?.alerts.length})</h2><div className="mt-3 space-y-2">{data?.alerts.slice(0, 5).map((item) => <div key={item.id} className="rounded-lg bg-[#fdeceb] px-3 py-2 text-sm"><p className="font-semibold text-[#b3544a]">{item.title}</p><p className="mt-0.5 text-xs text-[#5f7c70]">{item.detail}</p></div>)}</div></section>}
    </>}
  </div>;
}

function StatCard({ icon: Icon, label, value, detail, onClick, variant }: { icon: ComponentType<{ className?: string }>; label: string; value: string; detail: string; onClick?: () => void; variant?: "danger" }) {
  return <button onClick={onClick} disabled={!onClick} className="rounded-2xl border border-[#e1e9e5] bg-white p-5 text-left transition enabled:hover:border-[#c2ddd5] disabled:cursor-default"><div className="flex items-start justify-between"><p className="text-xs font-semibold text-[#78908a]">{label}</p><span className="rounded-lg bg-[#edf7f2] p-2 text-[#4f9d78]"><Icon className="h-4 w-4" /></span></div><p className={`mt-3 text-2xl font-bold ${variant === "danger" ? "text-[#b3544a]" : "text-[#173f3c]"}`}>{value}</p><p className="mt-1 text-xs text-[#78908a]">{detail}</p></button>;
}

function BreakdownBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return <div><div className="flex items-center justify-between text-xs"><span className="text-[#5f7c70]">{label}</span><span className="font-bold text-[#173f3c]">{value}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f7faf8]"><div className="h-full rounded-full" style={{ width: `${percentage}%`, background: color }} /></div></div>;
}
