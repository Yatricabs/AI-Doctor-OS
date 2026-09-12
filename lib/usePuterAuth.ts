// React hook for the combined-login flow. Tracks the Puter (User-Pays) auth
// session so the app can gate entry on it and never re-prompt mid-session.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPuterUser,
  isPuterSignedIn,
  puterSignIn,
  puterSignOut,
  PuterUnavailableError,
  waitForPuter,
  type PuterUserInfo,
} from "./puterClient";

export type PuterAuthState = {
  ready: boolean;        // Puter.js script has loaded
  signedIn: boolean;     // a Puter session exists in this browser
  user: PuterUserInfo | null;
  loading: boolean;      // a sign-in attempt is in progress
  unavailable: boolean;  // Puter.js failed to load (offline / blocked)
  error: string;
};

export function usePuterAuth() {
  const [state, setState] = useState<PuterAuthState>({
    ready: false,
    signedIn: false,
    user: null,
    loading: false,
    unavailable: false,
    error: "",
  });

  // On mount: wait for the script, then reflect any existing session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await waitForPuter();
      if (cancelled) return;
      if (!ok) {
        setState((s) => ({ ...s, ready: false, unavailable: true }));
        return;
      }
      const signedIn = isPuterSignedIn();
      const user = signedIn ? await getPuterUser() : null;
      if (cancelled) return;
      setState((s) => ({ ...s, ready: true, unavailable: false, signedIn, user }));
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      await puterSignIn();
      const user = await getPuterUser();
      setState((s) => ({ ...s, loading: false, signedIn: isPuterSignedIn(), user }));
      return true;
    } catch (e) {
      const unavailable = e instanceof PuterUnavailableError;
      setState((s) => ({
        ...s,
        loading: false,
        unavailable,
        error: unavailable
          ? "AI service could not load in this browser. Check your connection and try again."
          : "Sign-in was cancelled or failed. Please try again.",
      }));
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    puterSignOut();
    setState((s) => ({ ...s, signedIn: false, user: null }));
  }, []);

  return { ...state, signIn, signOut };
}
