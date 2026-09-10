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
      <div className="absolute top-[1200px] right-0 w-[600px] h-[600px] bg-cyan-500/10 blur-[160px] pointer-events-none rounded-full" />
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


