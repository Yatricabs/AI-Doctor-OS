"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { navigate, workspaceSelectors, type AppDispatch, type WorkspaceNav } from "@/lib/workspaceStore";
import Link from "next/link";
import { CalendarDays, LayoutDashboard, Package, Receipt, Stethoscope, Users } from "lucide-react";
import DashboardScreen from "./workspace/DashboardScreen";
import AppointmentsScreen from "./workspace/AppointmentsScreen";
import PatientsScreen from "./workspace/PatientsScreen";
import InventoryScreen from "./workspace/InventoryScreen";
import BillingScreen from "./workspace/BillingScreen";

// Doctor workspace shell. Clinic-workflow navigation:
//   Dashboard · Appointments · Patients · Inventory · Billing
// (The earlier AI tool UIs were removed from this view; their API routes,
//  lib/puterClient, lib/clientPrompts and components/workspace/{PrescriptionBuilder,
//  PreVisitBrief,AIResponse} remain for later doctor-facing reuse.)

type Nav = "Dashboard" | "Appointments" | "Patients" | "Inventory" | "Billing";

const NAV: { label: Nav; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays },
  { label: "Patients", icon: Users },
  { label: "Inventory", icon: Package },
  { label: "Billing", icon: Receipt },
];

function navFromQuery(value: string | null): WorkspaceNav {
  return NAV.some((item) => item.label === value) ? value as WorkspaceNav : "Dashboard";
}

export default function DoctorWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const activeNav = useSelector(workspaceSelectors.activeNav);
  const selectedPatientId = useSelector(workspaceSelectors.selectedPatientId);

  useEffect(() => {
    const screen = searchParams.get("screen");
    dispatch(navigate({ nav: navFromQuery(screen), patientId: searchParams.get("patientId") }));
    if (!screen) router.replace(`${pathname}?screen=Dashboard`);
  }, [dispatch, pathname, router, searchParams]);

  function goto(nav: string, patientId?: string) {
    const nextNav = navFromQuery(nav);
    dispatch(navigate({ nav: nextNav, patientId }));
    const params = new URLSearchParams();
    params.set("screen", nextNav);
    if (nextNav === "Patients" && patientId) params.set("patientId", patientId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[76px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[264px] md:px-5 md:py-8">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#078d79] text-white"><Stethoscope className="h-6 w-6" /></span>
          <span className="hidden text-[22px] font-bold tracking-[-0.05em] text-[#193d3a] md:inline">AI UPCHAR</span>
        </Link>
        <p className="mt-10 hidden px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#86a09a] md:block">Workspace</p>
        <nav className="mt-4 space-y-1.5">
          {NAV.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => goto(label)}
              aria-label={label}
              className={`flex w-full items-center justify-center gap-3.5 rounded-xl px-3 py-3 text-left text-[15px] font-semibold transition md:justify-start md:px-4 ${activeNav === label ? "bg-[#153f3c] text-white shadow-[0_10px_20px_rgba(21,63,60,0.14)]" : "text-[#6c8782] hover:bg-white/60 hover:text-[#315d57]"}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl p-1 md:p-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d5eee4] text-xs font-bold text-[#277a6b]">DA</span>
          <span className="hidden md:block">
            <strong className="block text-sm text-[#214440]">Dr. Ananya Arya</strong>
            <span className="mt-0.5 block text-xs text-[#78918c]">General Medicine</span>
          </span>
        </div>
      </aside>

      {/* Content */}
      <div className="ml-[76px] md:ml-[264px]">
        {activeNav === "Dashboard" && <DashboardScreen onGoto={goto} />}
        {activeNav === "Appointments" && <AppointmentsScreen onOpenPatient={(id) => goto("Patients", id)} />}
        {activeNav === "Patients" && <PatientsScreen selectedId={selectedPatientId} onSelect={(id) => goto("Patients", id ?? undefined)} />}
        {activeNav === "Inventory" && <InventoryScreen />}
        {activeNav === "Billing" && <BillingScreen />}
      </div>
    </main>
  );
}
