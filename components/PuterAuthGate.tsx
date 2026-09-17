"use client";

import { useEffect, useState } from "react";

type PuterUser = { username?: string; email?: string } | null;

export default function PuterAuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<PuterUser>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function checkAuth() {
    const auth = window.puter?.auth;
    if (!auth) return false;
    const isSignedIn = auth.isSignedIn();
    setSignedIn(isSignedIn);
    if (isSignedIn) setUser((await auth.getUser?.()) ?? null);
    setReady(true);
    return true;
  }

  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      if (await checkAuth() || attempts >= 30) {
        window.clearInterval(timer);
        if (attempts >= 30 && !window.puter?.auth) {
          setReady(true);
          setError("Puter login service load nahi ho paaya. Page refresh karke dobara try karein.");
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  async function login() {
    setBusy(true);
    setError("");
    try {
      await window.puter?.auth?.signIn();
      await checkAuth();
    } catch {
      setError("Puter login complete nahi ho paaya. Kripya dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="flex min-h-screen items-center justify-center bg-[#f5faf7] text-[#244642]">Puter login service load ho rahi hai…</main>;
  if (!signedIn) return <main className="flex min-h-screen items-center justify-center bg-[#f5faf7] px-6 text-[#244642]"><section className="w-full max-w-md rounded-2xl border border-[#dce9e3] bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d8f3e8] text-2xl">✦</div><h1 className="mt-5 text-2xl font-bold">Login to AI UPCHAR</h1><button onClick={() => void login()} disabled={busy} className="mt-6 w-full rounded-xl bg-[#07947f] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Opening Puter login…" : "Continue with Puter"}</button>{error && <p className="mt-4 text-sm text-[#b3544a]">{error}</p>}</section></main>;

  return <>{children}</>;
}
