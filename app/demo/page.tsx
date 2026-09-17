import OperationsShell from "@/components/ops/OperationsShell";
import ReduxProvider from "@/components/ReduxProvider";

export default function DemoPage() {
  return <ReduxProvider><OperationsShell /></ReduxProvider>;
}
