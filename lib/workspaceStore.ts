import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * The only client state shared by doctor-workspace screens. Server records and
 * workflow-local forms intentionally stay outside Redux (see docs/redux-state-audit.md).
 */
export type WorkspaceNav = "Dashboard" | "Appointments" | "Patients" | "Inventory" | "Billing";

export const WORKSPACE_NAV: readonly WorkspaceNav[] = ["Dashboard", "Appointments", "Patients", "Inventory", "Billing"];

type WorkspaceState = {
  activeNav: WorkspaceNav;
  selectedPatientId: string | null;
};

const initialState: WorkspaceState = { activeNav: "Dashboard", selectedPatientId: null };

export function workspaceNavFromQuery(value: string | null): WorkspaceNav {
  return WORKSPACE_NAV.includes(value as WorkspaceNav) ? value as WorkspaceNav : "Dashboard";
}

export function workspaceQuery(nav: WorkspaceNav, patientId?: string | null): string {
  const params = new URLSearchParams({ screen: nav });
  if (nav === "Patients" && patientId) params.set("patientId", patientId);
  return params.toString();
}

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    navigate(state, action: PayloadAction<{ nav: WorkspaceNav; patientId?: string | null }>) {
      state.activeNav = action.payload.nav;
      state.selectedPatientId = action.payload.nav === "Patients" ? action.payload.patientId ?? null : null;
    },
    selectPatient(state, action: PayloadAction<string | null>) {
      state.selectedPatientId = action.payload;
      state.activeNav = "Patients";
    },
  },
});

export const { navigate, selectPatient } = workspaceSlice.actions;

// One store instance is created for the doctor workspace provider. It contains
// no API cache or medical record payloads, preventing stale/sensitive global state.
export const workspaceStore = configureStore({ reducer: { workspace: workspaceSlice.reducer } });
export type RootState = ReturnType<typeof workspaceStore.getState>;
export type AppDispatch = typeof workspaceStore.dispatch;
export const workspaceSelectors = {
  activeNav: (state: RootState) => state.workspace.activeNav,
  selectedPatientId: (state: RootState) => state.workspace.selectedPatientId,
};
