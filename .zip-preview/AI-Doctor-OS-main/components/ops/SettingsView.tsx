"use client";

import { useEffect, useState } from "react";
import { useGetProfileQuery, useUpdateProfileMutation } from "@/lib/apiSlice";
import { tone } from "./shared";

type Settings = { fullName: string; specialty: string; clinicBio: string; availableToday: boolean; notifications: { urgentFollowUps: boolean; weeklySummary: boolean; twoStepSignIn: boolean } };

export default function SettingsView() {
  const { data, isLoading } = useGetProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (data?.settings) setSettings(data.settings);
  }, [data]);

  async function save() {
    if (!settings) return;
    setNotice("");
    try {
      await updateProfile(settings).unwrap();
      setNotice("Settings saved.");
    } catch {
      setNotice("Could not save settings.");
    }
  }

  if (isLoading || !settings) return <p className="text-sm" style={{ color: tone.muted }}>Loading settings…</p>;

  return (
    <div className="max-w-xl space-y-5">
      {notice && <p className="rounded-lg p-3 text-sm" style={{ background: tone.successBg, color: tone.success }}>{notice}</p>}
      <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        <h3 className="text-sm font-bold" style={{ color: tone.ink }}>Clinician profile</h3>
        <div className="mt-4 grid gap-3">
          <input value={settings.fullName} onChange={(e) => setSettings({ ...settings, fullName: e.target.value })} placeholder="Full name" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <input value={settings.specialty} onChange={(e) => setSettings({ ...settings, specialty: e.target.value })} placeholder="Specialty" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
          <textarea value={settings.clinicBio} onChange={(e) => setSettings({ ...settings, clinicBio: e.target.value })} placeholder="Clinic bio" className="min-h-20 rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
        </div>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-bold" style={{ color: tone.ink }}>Available today</h3><p className="text-xs" style={{ color: tone.muted }}>Marking away reschedules today&apos;s queue.</p></div>
          <button onClick={() => setSettings({ ...settings, availableToday: !settings.availableToday })} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#dce9e3", color: settings.availableToday ? tone.success : tone.danger }}>{settings.availableToday ? "Available" : "Away"}</button>
        </div>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        <h3 className="text-sm font-bold" style={{ color: tone.ink }}>Notifications</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(["urgentFollowUps", "weeklySummary", "twoStepSignIn"] as const).map((key) => <label key={key} className="flex items-center justify-between"><span style={{ color: tone.inkSoft }}>{key === "urgentFollowUps" ? "Urgent follow-up alerts" : key === "weeklySummary" ? "Weekly summary email" : "Two-step sign-in"}</span><input type="checkbox" checked={settings.notifications[key]} onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, [key]: e.target.checked } })} /></label>)}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: tone.primary }}>{saving ? "Saving…" : "Save settings"}</button>
    </div>
  );
}
