"use client";

// Patient portal: each past appointment with its own AI chat history + a
// read-only prescription. Fetches from /api/appointments/chat.
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Pill } from "lucide-react";

type ChatTurn = { role: "assistant" | "user"; content: string };
type Visit = {
  appointment: { id: string; appointmentDate?: string; appointmentTime?: string; visitType?: string; reason?: string; status?: string } | null;
  chat: { id: string; transcript: ChatTurn[]; createdAt: string } | null;
  prescription: { id: string; status?: string; notes?: string; items: { medicationName?: string; dose?: string; frequency?: string; duration?: string }[] } | null;
};

export default function PortalVisitHistory({ patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/appointments/chat?patientId=${encodeURIComponent(patientId)}`);
        const jr = await res.json() as { ok: boolean; data?: { visits: Visit[] } };
        setVisits(jr.ok ? jr.data?.visits ?? [] : []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [patientId]);

  return (
    <div className="mt-8 rounded-2xl border border-[#dce9e3] bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-[#07947f]" />
        <h2 className="font-bold text-[#1f3a37]">My visit history</h2>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : visits.length === 0 ? (
        <p className="text-sm text-[#9db3aa]">No past visits yet. Book an appointment to get started.</p>
      ) : (
        <div className="space-y-2">
          {visits.map((v, i) => {
            const key = v.appointment?.id ?? v.chat?.id ?? String(i);
            const date = v.appointment?.appointmentDate ?? v.chat?.createdAt?.slice(0, 10) ?? "—";
            const reason = v.appointment?.reason ?? (v.appointment?.visitType ?? "").replace(/_/g, " ") ?? "Pre-visit intake";
            const isOpen = open === key;
            return (
              <div key={key} className="rounded-lg border border-[#eef4f1]">
                <button onClick={() => setOpen(isOpen ? null : key)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#f7faf8]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#1f3a37]">{reason || "Visit"}</span>
                    <span className="text-[11px] text-[#78908a]">{date}{v.appointment?.appointmentTime ? ` · ${v.appointment.appointmentTime}` : ""}{v.prescription ? " · prescription" : ""}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-[#5a967e]">{isOpen ? "Hide" : "View"}</span>
                </button>
                {isOpen && (
                  <div className="space-y-2 border-t border-[#f0f4f2] px-4 py-3">
                    {v.chat && v.chat.transcript.length > 0 && (
                      <div className="rounded-lg border border-[#eef4f1] bg-[#fbfdfc] p-3">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#5a967e]">Your AI conversation</p>
                        <div className="max-h-64 space-y-1.5 overflow-y-auto">
                          {v.chat.transcript.map((t, j) => (
                            <p key={j} className={`text-xs leading-5 ${t.role === "user" ? "text-[#1f3a37]" : "text-[#5f7c70]"}`}>
                              <span className="font-semibold">{t.role === "user" ? "You: " : "AI: "}</span>{t.content}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {v.prescription && (
                      <div className="rounded-lg border border-[#c8e5d8] bg-[#f0faf5] p-3">
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#317b67]"><Pill className="h-3 w-3" /> Prescription</p>
                        {v.prescription.items.length ? v.prescription.items.map((it, j) => (
                          <p key={j} className="text-xs text-[#2f5a4a]">· {it.medicationName} {it.dose} {it.frequency}{it.duration ? ` · ${it.duration}` : ""}</p>
                        )) : <p className="text-xs text-[#7aa693]">No medicines listed.</p>}
                        {v.prescription.notes && <p className="mt-1 text-[11px] text-[#3f6b5c]">Advice: {v.prescription.notes}</p>}
                      </div>
                    )}
                    {!v.chat && !v.prescription && <p className="text-xs text-[#9db3aa]">No details recorded for this visit.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
