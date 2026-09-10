import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Doctor OS — The intelligent workspace for doctors",
  description:
    "AI Doctor OS brings patient context, clinical documentation, reports, safe prescribing, and follow-ups into one clinician-controlled workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080D14] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
