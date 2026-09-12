"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080D14]">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-red-200 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-300/80 mb-6">We encountered an error loading the workspace. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-bold text-white transition"
          >
            <RefreshCw className="h-4 w-4" /> Refresh page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
