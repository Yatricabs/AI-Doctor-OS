"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { navigate, workspaceNavFromQuery, workspaceQuery, workspaceSelectors, type WorkspaceNav } from "@/lib/workspaceStore";
import { useWorkspaceDispatch, useWorkspaceSelector } from "@/lib/reduxHooks";
import Link from "next/link";
import { BarChart3, Boxes, CalendarClock, FileText, IndianRupee, LayoutDashboard, Settings, Stethoscope, Users } from "lucide-react";
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

const NAV: { label: WorkspaceNav; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarClock },
  { label: "Patients", icon: Users },
  { label: "Reports & Documents", icon: FileText },
  { label: "Inventory", icon: Boxes },
  { label: "Billing", icon: IndianRupee },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

function navFromQuery(value: string | null): WorkspaceNav {
  return workspaceNavFromQuery(value);
}

export default function DoctorWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useWorkspaceDispatch();
  const activeNav = useWorkspaceSelector(workspaceSelectors.activeNav);
  const selectedPatientId = useWorkspaceSelector(workspaceSelectors.selectedPatientId);

  useEffect(() => {
    const screen = searchParams.get("screen");
    dispatch(navigate({ nav: navFromQuery(screen), patientId: searchParams.get("patientId") }));
    if (!screen) router.replace(`${pathname}?screen=Dashboard`);
  }, [dispatch, pathname, router, searchParams]);

  function goto(nav: string, patientId?: string) {
    const nextNav = navFromQuery(nav);
    dispatch(navigate({ nav: nextNav, patientId }));
    router.push(`${pathname}?${workspaceQuery(nextNav, patientId)}`);
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col items-center gap-1 border-r border-[#dce9e3] bg-[#f0f4f2] py-5 md:w-60 md:items-stretch md:px-4">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 px-2 md:justify-start">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#153f3c] text-white"><Stethoscope className="h-5 w-5" /></span>
          <span className="hidden text-sm font-extrabold text-[#173f3c] md:inline">AI UPCHAR</span>
        </Link>
        <nav className="space-y-1">
          {NAV.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => goto(label)}
              aria-label={label}
              className={`flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition md:justify-start ${activeNav === label ? "bg-[#153f3c] text-white" : "text-[#6c8782] hover:bg-white/60 hover:text-[#315d57]"}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-2 text-[10px] text-[#78908a] md:block">Patient &amp; Operations {"\u00b7"} Demo V2</div>
      </aside>

      {/* Content */}
      <div className="ml-16 md:ml-60">
        {activeNav === "Dashboard" && <DashboardScreen onGoto={goto} />}
        {activeNav === "Appointments" && <AppointmentsScreen onOpenPatient={(id) => goto("Patients", id)} />}
        {activeNav === "Patients" && <PatientsScreen selectedId={selectedPatientId} onSelect={(id) => goto("Patients", id ?? undefined)} />}
        {activeNav === "Inventory" && <InventoryScreen />}
        {activeNav === "Billing" && <BillingScreen onOpenPatient={(id) => goto("Patients", id)} />}
        {(activeNav === "Reports & Documents" || activeNav === "Analytics" || activeNav === "Settings") && <WorkspaceModulePlaceholder section={activeNav} />}
      </div>
    </main>
  );
}

function WorkspaceModulePlaceholder({ section }: { section: "Reports & Documents" | "Analytics" | "Settings" }) {
  const details: Record<typeof section, string> = {
    "Reports & Documents": "Lab reports, prescriptions and referrals will remain attached to the patient record.",
    Analytics: "Operational analytics can be opened from the dedicated analytics workspace.",
    Settings: "Clinician profile, availability and notification settings will appear here.",
  };
  return <section className="mx-auto max-w-[1280px] px-5 py-8 md:px-10"><h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">{section}</h1><p className="mt-1 text-sm text-[#78908a]">{details[section]}</p><div className="mt-6 rounded-2xl border border-[#dce9e3] bg-white p-6 text-sm text-[#54716d]">This navigation module is ready for its existing domain screen to be connected.</div></section>;
}
