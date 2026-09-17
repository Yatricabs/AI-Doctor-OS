import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type LandingState = { activeSection: string; appointmentDialogOpen: boolean };
const initialState: LandingState = { activeSection: "Home", appointmentDialogOpen: false };

const landingSlice = createSlice({
  name: "landing",
  initialState,
  reducers: {
    setActiveSection(state, action: PayloadAction<string>) { state.activeSection = action.payload; },
    openAppointmentDialog(state) { state.appointmentDialogOpen = true; },
    closeAppointmentDialog(state) { state.appointmentDialogOpen = false; },
  },
});

export const { setActiveSection, openAppointmentDialog, closeAppointmentDialog } = landingSlice.actions;
export default landingSlice.reducer;

