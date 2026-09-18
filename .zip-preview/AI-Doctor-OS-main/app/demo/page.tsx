import OperationsShell from "@/components/ops/OperationsShell";
import PuterAuthGate from "@/components/PuterAuthGate";

export default function DemoPage() {
  return <PuterAuthGate><OperationsShell /></PuterAuthGate>;
}
