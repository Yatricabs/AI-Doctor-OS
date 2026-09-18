import DoctorWorkspace from "@/components/DoctorWorkspace";
import ErrorBoundary from "@/components/ErrorBoundary";
import WorkspaceReduxProvider from "@/components/WorkspaceReduxProvider";
import { Suspense } from "react";

export const metadata = {
  title: "AI UPCHAR Live Demo — Doctor Workspace",
  description: "Interactive demo of the AI UPCHAR doctor workspace with patient context, clinical AI, and prescription safety.",
};

export default function DemoPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<main className="min-h-screen bg-[#f7faf8]" />}>
        <WorkspaceReduxProvider>
          <DoctorWorkspace />
        </WorkspaceReduxProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
