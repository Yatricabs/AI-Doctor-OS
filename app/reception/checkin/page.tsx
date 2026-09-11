"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Clock, RefreshCw, Search, Stethoscope, UserCheck, Users, UserPlus, AlertTriangle } from "lucide-react";

type Patient = { id: string; name: string; initials: string; appointment: string; status: string; phone?: string };
type QueueEntry = { id: string; patientId: string; patientName?: string; tokenNumber?: string; priority: string; status: string; position?: number; estimatedWaitMinutes?: number; isWalkIn: number };

export default function CheckInPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkedInId, setCheckedInId] = useState("");
  const [tokenResult, setTokenResult] = useState<{ tokenNumber: string; position: number; estimatedWait: number } | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue?clinicId=clinic-001");
      const payload = await res.json() as { ok: boolean; data: { queue: { entries: QueueEntry[] } } };
      if (payload.ok) setQueue(payload.data.queue.entries);
    } catch { /* silent */ }
  }, []);

  async function searchPatients() {
    if (!search.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(search)}`);
      const payload = await res.json() as { ok: boolean; data: { patients: Patient[] } };
      if (payload.ok) setPatients(payload.data.patients);
    } catch { setError("Search failed."); }
    finally { setLoading(false); }
  }

  async function checkIn(patientId: string, isWalkIn = false) {
    setLoading(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin", patientId, isWalkIn }),
      });
      const payload = await res.json() as {
        ok: boolean;
        data: { tokenNumber: string; position: number; estimatedWaitMinutes: number; message: string };
        error?: { message: string };
      };
      if (payload.ok) {
        setCheckedInId(patientId);
        setTokenResult({ tokenNumber: payload.data.tokenNumber, position: payload.data.position, estimatedWait: payload.data.estimatedWaitMinutes });
        setNotice(payload.data.message);
        await loadQueue();
      } else setError(payload.error?.message ?? "Check-in failed.");
    } catch { setError("Check-in failed."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const inQueue = queue.filter((q) => q.status === "waiting" || q.status === "called" || q.status === "in_consultation");
  const waiting = inQueue.filter((q) => q.status === "waiting");

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078d79] text-white"><Stethoscope className="h-4 w-4" /></span>
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs font-bold text-[#4e927d]">Reception</span>
            <Link href="/doctor/queue" className="text-xs text-[#5a967e] hover:underline">Doctor queue →</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">Reception Workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">Patient Check-in</h1>
        </div>

        {notice && (
          <div className="mb-5 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#07947f]" />
              <p className="text-sm font-medium text-[#317b67]">{notice}</p>
            </div>
            {tokenResult && (
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xl font-bold text-[#07947f]">{tokenResult.tokenNumber}</p>
                  <p className="text-xs text-[#78908a]">Token</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xl font-bold text-[#173f3c]">{tokenResult.position}</p>
                  <p className="text-xs text-[#78908a]">Position</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xl font-bold text-[#173f3c]">~{tokenResult.estimatedWait}m</p>
                  <p className="text-xs text-[#78908a]">Est. wait</p>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Left: Search & Check-in */}
          <div className="space-y-4">
            {/* Patient Search */}
            <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
              <h2 className="text-base font-bold text-[#244642] mb-3">Search patient</h2>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8da09b]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchPatients()} placeholder="Name or patient ID…" className="w-full rounded-lg border border-[#dce9e3] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#07947f]" />
                </div>
                <button onClick={() => void searchPatients()} disabled={loading} className="rounded-lg bg-[#07947f] px-4 text-sm font-bold text-white disabled:opacity-60">Search</button>
              </div>

              {patients.length > 0 && (
                <div className="mt-4 space-y-2">
                  {patients.map((patient) => {
                    const alreadyIn = inQueue.some((q) => q.patientId === patient.id);
                    return (
                      <div key={patient.id} className="flex items-center gap-3 rounded-xl border border-[#e1e9e5] p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4f3ed] text-sm font-bold text-[#4e927d]">{patient.initials}</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#244642]">{patient.name}</p>
                          <p className="text-xs text-[#78908a]">{patient.id} · {patient.appointment}</p>
                        </div>
                        {alreadyIn ? (
                          <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs font-bold text-[#4e927d]">In queue</span>
                        ) : (
                          <button onClick={() => void checkIn(patient.id)} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-[#07947f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                            <UserCheck className="h-3.5 w-3.5" /> Check in
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Walk-in Registration */}
            <WalkInForm onCheckIn={(pid) => void checkIn(pid, true)} loading={loading} />
          </div>

          {/* Right: Live Queue */}
          <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#244642]">Live queue ({waiting.length} waiting)</h2>
              <button onClick={() => void loadQueue()} className="text-[#5a967e]"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2">
              {inQueue.length === 0 && <p className="text-sm text-[#78908a]">Queue is empty.</p>}
              {inQueue.map((entry) => (
                <div key={entry.id} className={`rounded-lg border p-3 ${entry.status === "in_consultation" ? "border-[#07947f] bg-[#edf7f2]" : entry.priority === "urgent" ? "border-red-200 bg-red-50" : "border-[#e1e9e5]"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#244642]">{entry.patientName ?? entry.patientId}</p>
                      <p className="text-xs text-[#78908a]">Token: {entry.tokenNumber} · ~{entry.estimatedWaitMinutes}m</p>
                    </div>
                    <div className="text-right">
                      <span className={`block text-[10px] font-bold uppercase ${entry.status === "in_consultation" ? "text-[#07947f]" : entry.priority === "urgent" ? "text-red-500" : "text-[#78908a]"}`}>
                        {entry.status === "in_consultation" ? "In consultation" : `#${entry.position}`}
                      </span>
                      {entry.isWalkIn === 1 && <span className="text-[9px] font-bold text-purple-500">WALK-IN</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function WalkInForm({ onCheckIn, loading }: { onCheckIn: (patientId: string) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [notice2, setNotice2] = useState("");
  const [error2, setError2] = useState("");

  async function registerAndCheckIn() {
    if (!name.trim()) { setError2("Name is required."); return; }
    setError2("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, appointment: `Walk-in · ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` }),
      });
      const payload = await res.json() as { ok: boolean; data: { patient: { id: string } }; error?: { message: string } };
      if (payload.ok) {
        setNotice2(`Patient registered as ${payload.data.patient.id}`);
        onCheckIn(payload.data.patient.id);
        setName(""); setPhone(""); setReason("");
      } else setError2(payload.error?.message ?? "Registration failed.");
    } catch { setError2("Registration failed."); }
  }

  return (
    <section className="rounded-2xl border border-dashed border-[#c2ddd5] bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#244642] mb-3"><UserPlus className="h-4 w-4 text-[#5a967e]" /> Walk-in registration</h2>
      {notice2 && <p className="mb-3 rounded-lg bg-[#edf7f2] p-2 text-xs text-[#317b67]">{notice2}</p>}
      {error2 && <p className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error2}</p>}
      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Patient name *" className="w-full rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for visit (optional)" className="w-full rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
      </div>
      <button onClick={() => void registerAndCheckIn()} disabled={loading || !name.trim()} className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-[#124b47] py-2.5 text-sm font-bold text-white disabled:opacity-50">
        <UserPlus className="h-4 w-4" /> Register & check in
      </button>
    </section>
  );
}
