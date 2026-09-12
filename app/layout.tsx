import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import ScrollReset from "@/components/ScrollReset";

export const metadata: Metadata = {
  title: "AI UPCHAR — Intelligent Clinical Workspace for Doctors",
  description:
    "AI UPCHAR brings patient context, clinical documentation, reports, safe prescribing, and follow-ups into one clinician-controlled workspace. For government hospitals, private hospitals, and clinics.",
  keywords: ["healthcare", "AI", "clinical", "doctors", "medical records", "patient care", "telemedicine"],
  authors: [{ name: "AI UPCHAR" }],
  creator: "AI UPCHAR",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "AI UPCHAR — Intelligent Clinical Workspace",
    description: "Patient context, clinical AI, and doctor-controlled decision making in one workspace",
    type: "website",
    siteName: "AI UPCHAR",
  },
};

// Next.js 14 requires viewport as its own export, not inside metadata.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Puter.js — client-side AI (https://developer.puter.com/ai/). Runs in the
          browser on Puter's free "User-Pays" model, so there is no server AI cost.
          Used for clinical AI (copilot, symptom, scribe), intake question phrasing,
          and vision analysis of uploaded patient reports (GPT + Gemini).
        */}
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
      </head>
      <body className="bg-[#080D14] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
        <ScrollReset />
        {children}
      </body>
    </html>
  );
}
