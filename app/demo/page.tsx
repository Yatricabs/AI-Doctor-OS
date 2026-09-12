import DoctorWorkspace from "@/components/DoctorWorkspace";
import ErrorBoundary from "@/components/ErrorBoundary";
import PuterLoginGate from "@/components/PuterLoginGate";

export const metadata = {
  title: "AI UPCHAR Live Demo — Doctor Workspace",
  description: "Interactive demo of the AI UPCHAR doctor workspace with patient context, clinical AI, and prescription safety.",
};

export default function DemoPage() {
  return (
    <ErrorBoundary>
      <PuterLoginGate title="Doctor Workspace">
        <DoctorWorkspace />
      </PuterLoginGate>
    </ErrorBoundary>
  );
}
