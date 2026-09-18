import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ScrollReset from "@/components/ScrollReset";
import ReduxProvider from "@/components/ReduxProvider";

export const metadata: Metadata = {
  title: "AI UPCHAR — The intelligent workspace for doctors",
  description:
    "AI UPCHAR brings patient context, clinical documentation, reports, safe prescribing, and follow-ups into one clinician-controlled workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080D14] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
        {/* Client-side AI (Puter.js): each visitor's own Puter account is billed
            for their own usage ("User-Pays"), so the app itself never pays for
            AI calls. Loaded once, globally, as window.puter. */}
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <ReduxProvider>
          <ScrollReset />
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
