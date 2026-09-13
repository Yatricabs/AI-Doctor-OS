"use client";

import { Provider } from "react-redux";
import { workspaceStore } from "@/lib/workspaceStore";

export default function WorkspaceReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={workspaceStore}>{children}</Provider>;
}
