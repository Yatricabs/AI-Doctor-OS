"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";

type PrescriptionItem = {
  medicationName: string;
  genericName: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
};

type SafetyCheck = {
  id: string;
  checkType: string;
  medicationA?: string;
  medicationB?: string;
  severity: string;
  message: string;
  recommendation?: string;
  isOverridden: boolean;
};

type Prescription = {
  id: string;
  status: string;
  items: PrescriptionItem[];
  safetyChecks: SafetyCheck[];
};

const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "Once at night", "Every 8 hours", "Every 12 hours", "Once weekly", "As needed (PRN)"];
const ROUTES = ["oral", "sublingual", "inhaled", "topical", "intravenous", "intramuscular", "subcutaneous", "rectal", "nasal", "ophthalmic", "otic"];

const EMPTY_ITEM: PrescriptionItem = { medicationName: "", genericName: "", dose: "", frequency: "Once daily", route: "oral", duration: "", instructions: "" };

export default function PrescriptionBuilder({ patientId, visitId }: { patientId: string; visitId?: string }) {
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>([]);
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<"draft" | "safety" | "review" | "signed" | "dispatched">("draft");

  function addItem() { setItems([...items, { ...EMPTY_ITEM }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof PrescriptionItem, value: string) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  async function createDraft() {
    const validItems = items.filter((i) => i.medicationName.trim() && i.dose.trim());
    if (validItems.length === 0) { setError("Add at least one medication with name and dose."); return; }
    setLoading("creating"); setError(""); setNotice("");
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", patientId, visitId, items: validItems }),
      });
      const payload = await res.json() as { ok: boolean; data: { prescription: Prescription }; error?: { message: string } };
      if (payload.ok) { setPrescription(payload.data.prescription); setStep("safety"); setNotice("Draft created. Running safety checks…"); await runSafetyChecks(payload.data.prescription.id); }
      else setError(payload.error?.message ?? "Could not create prescription.");
    } catch { setError("Network error."); }
    finally { setLoading(""); }
  }

  async function runSafetyChecks(rxId?: string) {
    const id = rxId ?? prescription?.id;
    if (!id) return;
    setLoading("safety"); setError("");
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "safety_check", prescriptionId: id }),
      });
      const payload = await res.json() as {
        ok: boolean;
        data: { safetyChecks: SafetyCheck[]; totalAlerts: number; hasBlockedAlerts: boolean; canProceed: boolean; message: string };
        error?: { message: string };
      };
      if (payload.ok) {
        setSafetyChecks(payload.data.safetyChecks);
        setNotice(payload.data.message);
        setStep("review");
      } else setError(payload.error?.message ?? "Safety check failed.");
    } catch { setError("Safety check failed."); }
    finally { setLoading(""); }
  }

  async function overrideAlert(checkId: string) {
    const reason = overrideReasons[checkId];
    if (!reason?.trim()) { setError("Provide a clinical reason before overriding a safety alert."); return; }
    setLoading(`override-${checkId}`); setError("");
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "override_alert", checkId, reason }),
      });
      const payload = await res.json() as { ok: boolean };
      if (payload.ok) {
        setSafetyChecks(safetyChecks.map((c) => c.id === checkId ? { ...c, isOverridden: true } : c));
        setNotice("Alert overridden with documented reason.");
      }
    } catch { setError("Override failed."); }
    finally { setLoading(""); }
  }

  async function sign() {
    if (!prescription) return;
    setLoading("signing"); setError("");
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", prescriptionId: prescription.id }),
      });
      const payload = await res.json() as { ok: boolean; data: { message: string }; error?: { message: string } };
      if (payload.ok) { setStep("signed"); setNotice(payload.data.message); }
      else setError(payload.error?.message ?? "Could not sign prescription.");
    } catch { setError("Signing failed."); }
    finally { setLoading(""); }
  }

  async function dispatch(channel: string) {
    if (!prescription) return;
    setLoading("dispatching"); setError("");
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispatch", prescriptionId: prescription.id, channel }),
      });
      const payload = await res.json() as { ok: boolean; data: { message: string }; error?: { message: string } };
      if (payload.ok) { setStep("dispatched"); setNotice(payload.data.message); }
      else setError(payload.error?.message ?? "Dispatch failed.");
    } catch { setError("Dispatch failed."); }
    finally { setLoading(""); }
  }

  const blockedAlerts = safetyChecks.filter((c) => c.severity === "blocked" && !c.isOverridden);
  const canSign = blockedAlerts.length === 0;

  return (
    <div className="rounded-2xl border border-[#e1e9e5] bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e1e9e5] px-5 py-4">
        <h2 className="text-base font-bold text-[#244642]">Prescription builder</h2>
        <div className="flex items-center gap-2">
          {["draft", "safety", "review", "signed", "dispatched"].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${step === s ? "bg-[#07947f]" : ["draft", "safety", "review", "signed", "dispatched"].indexOf(step) > i ? "bg-[#a0d9cc]" : "bg-[#dce9e3]"}`} />
              {i < 4 && <div className="h-px w-3 bg-[#dce9e3]" />}
            </div>
          ))}
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[#78908a] capitalize">{step}</span>
        </div>
      </div>

      <div className="p-5">
        {notice && <div className="mb-4 rounded-lg border border-[#b9decf] bg-[#f0faf5] px-3 py-2 text-sm text-[#317b67]">{notice}</div>}
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {/* STEP: Draft */}
        {step === "draft" && (
          <div>
            {items.map((item, i) => (
              <div key={i} className="mb-4 rounded-xl border border-[#e1e9e5] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Medication {i + 1}</p>
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="text-[#78908a] hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={item.medicationName} onChange={(e) => updateItem(i, "medicationName", e.target.value)} placeholder="Medication name *" className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
                  <input value={item.genericName} onChange={(e) => updateItem(i, "genericName", e.target.value)} placeholder="Generic name" className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
                  <input value={item.dose} onChange={(e) => updateItem(i, "dose", e.target.value)} placeholder="Dose (e.g. 500mg) *" className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
                  <select value={item.frequency} onChange={(e) => updateItem(i, "frequency", e.target.value)} className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]">
                    {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <select value={item.route} onChange={(e) => updateItem(i, "route", e.target.value)} className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]">
                    {ROUTES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <input value={item.duration} onChange={(e) => updateItem(i, "duration", e.target.value)} placeholder="Duration (e.g. 7 days)" className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
                  <input value={item.instructions} onChange={(e) => updateItem(i, "instructions", e.target.value)} placeholder="Special instructions" className="rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f] sm:col-span-2" />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button onClick={addItem} className="flex items-center gap-1.5 rounded-lg border border-[#dce9e3] px-3 py-2 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3]">
                <Plus className="h-3.5 w-3.5" /> Add medication
              </button>
              <button onClick={() => void createDraft()} disabled={!!loading} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#07947f] py-2 text-sm font-bold text-white disabled:opacity-60">
                {loading === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading === "creating" ? "Creating…" : "Create & run safety checks"}
              </button>
            </div>
          </div>
        )}

        {/* STEP: Safety Review */}
        {step === "review" && (
          <div>
            {safetyChecks.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-4">
                <CheckCircle2 className="h-5 w-5 text-[#07947f]" />
                <div>
                  <p className="text-sm font-bold text-[#1f6a4a]">No safety issues detected</p>
                  <p className="text-xs text-[#317b67]">No allergies, interactions, or duplications found.</p>
                </div>
              </div>
            ) : (
              <div className="mb-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#78908a]">Safety checks — {safetyChecks.length} alert{safetyChecks.length > 1 ? "s" : ""}</p>
                {safetyChecks.map((check) => (
                  <div key={check.id} className={`rounded-xl border p-3 ${check.severity === "blocked" && !check.isOverridden ? "border-red-300 bg-red-50" : check.isOverridden ? "border-green-200 bg-green-50 opacity-60" : check.severity === "severe" ? "border-amber-300 bg-amber-50" : "border-[#e1e9e5]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          {check.severity === "blocked" && !check.isOverridden && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          {check.isOverridden && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                          <span className={`text-[10px] font-bold uppercase ${check.severity === "blocked" ? "text-red-500" : check.severity === "severe" ? "text-amber-600" : "text-[#78908a]"}`}>
                            {check.severity} · {check.checkType}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#244642]">{check.message}</p>
                        {check.recommendation && <p className="mt-0.5 text-xs text-[#5f7c70] italic">{check.recommendation}</p>}
                        {check.isOverridden && <p className="mt-0.5 text-[10px] text-green-600 font-bold">Overridden with documented reason</p>}
                      </div>
                    </div>
                    {!check.isOverridden && (check.severity === "blocked" || check.severity === "severe") && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={overrideReasons[check.id] ?? ""}
                          onChange={(e) => setOverrideReasons({ ...overrideReasons, [check.id]: e.target.value })}
                          placeholder="Clinical reason to override (required)"
                          className="flex-1 rounded-lg border border-[#dce9e3] px-2 py-1.5 text-xs outline-none focus:border-[#07947f]"
                        />
                        <button onClick={() => void overrideAlert(check.id)} disabled={!!loading} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-100 disabled:opacity-50">
                          Override
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Items summary */}
            {prescription?.items && prescription.items.length > 0 && (
              <div className="mb-4 rounded-xl bg-[#f7faf8] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e] mb-2">Prescription items</p>
                {prescription.items.map((item, i) => (
                  <p key={i} className="text-xs text-[#5f7c70] py-0.5 border-b border-[#eef2ef] last:border-0">
                    <strong>{item.medicationName}</strong> {item.dose} — {item.frequency} ({item.route})
                    {item.duration && ` for ${item.duration}`}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {blockedAlerts.length > 0 && (
                <div className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {blockedAlerts.length} blocked alert{blockedAlerts.length > 1 ? "s" : ""} must be resolved before signing.
                </div>
              )}
              {canSign && (
                <button onClick={() => void sign()} disabled={!!loading} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#07947f] py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {loading === "signing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {loading === "signing" ? "Signing…" : "Sign prescription"}
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] text-[#8a9e98]">By signing, the prescribing clinician accepts full clinical responsibility. This system provides assistive safety checks only.</p>
          </div>
        )}

        {/* STEP: Signed */}
        {step === "signed" && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-4">
              <CheckCircle2 className="h-6 w-6 text-[#07947f]" />
              <div>
                <p className="font-bold text-[#1f6a4a]">Prescription signed</p>
                <p className="text-xs text-[#317b67]">Signed by Dr. Ananya Arya. Ready to dispatch to patient.</p>
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#5a967e] mb-2">Dispatch via</p>
            <div className="flex gap-2 flex-wrap">
              {["whatsapp", "sms", "print"].map((ch) => (
                <button key={ch} onClick={() => void dispatch(ch)} disabled={!!loading} className="flex-1 rounded-lg border border-[#dce9e3] py-2 text-sm font-semibold capitalize text-[#54716d] hover:bg-[#edf7f2] hover:border-[#07947f] disabled:opacity-50">
                  {loading === "dispatching" ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : ch}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Dispatched */}
        {step === "dispatched" && (
          <div className="flex items-center gap-3 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-5">
            <CheckCircle2 className="h-7 w-7 text-[#07947f]" />
            <div>
              <p className="font-bold text-[#1f6a4a]">Prescription dispatched</p>
              <p className="text-sm text-[#317b67]">Patient instructions have been sent. Prescription ID: {prescription?.id}</p>
              <button onClick={() => { setStep("draft"); setItems([{ ...EMPTY_ITEM }]); setPrescription(null); setSafetyChecks([]); setNotice(""); }} className="mt-2 text-xs font-bold text-[#07947f] hover:underline">Create new prescription →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
