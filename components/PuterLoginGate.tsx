// Combined login gate: signs the user into the workspace AND connects their
// Puter (User-Pays) AI session in one step, up front. After this, AI calls
// (Copilot / Scribe / Symptom / report vision) run without any further popup.
//
// Wrap a workspace with <PuterLoginGate> to require the combined login before entry.
"use client";

import { useState } from "react";
import { Loader2, LogOut, ShieldCheck, Sparkles, Stethoscope, TriangleAlert } from "lucide-react";
import { usePuterAuth } from "@/lib/usePuterAuth";

type Props = {
  children: React.ReactNode;
  /** Shown on the login card, e.g. "Doctor Workspace". */
  title?: string;
  /** If true, allow entering without AI when Puter can't load (degraded mode). */
  allowSkipWhenUnavailable?: boolean;
};

export default function PuterLoginGate({ children, title = "Doctor Workspace", allowSkipWhenUnavailable = true }: Props) {
  const auth = usePuterAuth();
  const [name, setName] = useState("");
  const [skipped, setSkipped] = useState(false);

  // Already signed in (session persisted), or user chose degraded mode → show app.
  if (auth.signedIn || skipped) {
    return (
      <>
        <PuterSessionBar username={auth.user?.username} onSignOut={auth.signOut} degraded={skipped && !auth.signedIn} />
        {children}
      </>
    );
  }

  const booting = !auth.ready && !auth.unavailable;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-5 py-10 text-[#183b39]">
      <div className="w-full max-w-md rounded-2xl border border-[#e1e9e5] bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#078d79] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
        </div>

        <h1 className="mt-6 text-xl font-bold text-[#173f3c]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#5a7a6e]">
          Sign in to enter the workspace. This also connects AI (Copilot, Scribe, report reading) to your account,
          so it&apos;s ready instantly — no pop-up in the middle of your work.
        </p>

        <div className="mt-6">
          <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Your name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Ananya Arya"
            className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]"
          />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#dbe6ee] bg-[#f2f7fb] p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#3a6f8f]" />
          <p className="text-xs leading-5 text-[#41627a]">
            AI runs on your own Puter account&apos;s free quota (User-Pays). A sign-in window opens once, then your
            session is remembered on this device.
          </p>
        </div>

        {auth.error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{auth.error}</div>
        )}

        {auth.unavailable && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-5 text-amber-700">
              AI service couldn&apos;t load in this browser. You can still enter the workspace — AI features will be
              unavailable until you reconnect.
            </p>
          </div>
        )}

        <button
          onClick={() => void auth.signIn()}
          disabled={booting || auth.loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white transition hover:bg-[#066d66] disabled:opacity-60"
        >
          {booting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
          ) : auth.loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Connecting AI…</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> Enter workspace &amp; connect AI</>
          )}
        </button>

        {allowSkipWhenUnavailable && auth.unavailable && (
          <button
            onClick={() => setSkipped(true)}
            className="mt-2 w-full rounded-xl border border-[#dce9e3] py-2.5 text-sm font-semibold text-[#5a967e] hover:bg-[#f0f6f3]"
          >
            Enter without AI
          </button>
        )}

        <p className="mt-4 text-center text-[11px] text-[#8a9e98]">
          AI assists · the clinician always decides. Nothing is prescribed or sent without your approval.
        </p>
      </div>
    </main>
  );
}

// Small persistent status bar shown once inside the workspace.
function PuterSessionBar({ username, onSignOut, degraded }: { username?: string; onSignOut: () => void; degraded: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#e4ebe7] bg-white px-4 py-1.5 text-[11px]">
      <span className="flex items-center gap-1.5 text-[#5a967e]">
        {degraded ? (
          <><TriangleAlert className="h-3 w-3 text-amber-500" /> AI not connected — running in limited mode</>
        ) : (
          <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI connected{username ? ` · ${username}` : ""}</>
        )}
      </span>
      {!degraded && (
        <button onClick={onSignOut} className="flex items-center gap-1 text-[#78908a] hover:text-[#07947f]">
          <LogOut className="h-3 w-3" /> Disconnect AI
        </button>
      )}
    </div>
  );
}
