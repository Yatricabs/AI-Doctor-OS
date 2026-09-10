import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WorkflowSection from "@/components/WorkflowSection";
import InteractiveEngineSection from "@/components/InteractiveEngineSection";
import ProblemsSection from "@/components/ProblemsSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden relative">
      <div className="pointer-events-none absolute right-0 top-[1200px] h-[600px] w-[min(600px,100%)] rounded-full bg-cyan-500/10 blur-[160px]" />
      <Header />
      <Hero />
      <InteractiveEngineSection />
      <WorkflowSection />
      <ProblemsSection />
      <FeaturesGrid />
      <CTASection />
      <Footer />
    </main>
  );
}
