import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type WorkspaceNav = "Dashboard" | "Appointments" | "Patients" | "Inventory" | "Billing";

type WorkspaceState = {
  activeNav: WorkspaceNav;
  selectedPatientId: string | null;
};

const initialState: WorkspaceState = { activeNav: "Dashboard", selectedPatientId: null };

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

export const workspaceStore = configureStore({ reducer: { workspace: workspaceSlice.reducer } });
export type RootState = ReturnType<typeof workspaceStore.getState>;
export type AppDispatch = typeof workspaceStore.dispatch;
export const workspaceSelectors = {
  activeNav: (state: RootState) => state.workspace.activeNav,
  selectedPatientId: (state: RootState) => state.workspace.selectedPatientId,
};
