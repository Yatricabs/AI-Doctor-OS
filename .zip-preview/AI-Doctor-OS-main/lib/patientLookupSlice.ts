import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Patient } from "@/components/ops/shared";

type LookupState = { matches: Patient[]; loading: boolean; checkedPhone: string; activeRequestId: string; error: string };
const initialState: LookupState = { matches: [], loading: false, checkedPhone: "", activeRequestId: "", error: "" };
export const lookupPatientByPhone = createAsyncThunk<Patient[], string>("patientLookup/byPhone", async (phone) => {
  const response = await fetch(`/api/patients?q=${encodeURIComponent(phone)}`);
  if (!response.ok) throw new Error("Patient lookup failed");
  const envelope = await response.json() as { data?: { patients?: Patient[] } };
  return (envelope.data?.patients ?? []).filter((patient) => patient.phone?.replace(/\D/g, "").slice(-10) === phone);
});
const patientLookupSlice = createSlice({ name: "patientLookup", initialState, reducers: { clearLookup: (state) => { state.matches = []; state.checkedPhone = ""; state.activeRequestId = ""; } }, extraReducers: (builder) => builder.addCase(lookupPatientByPhone.pending, (state, action) => { state.loading = true; state.checkedPhone = action.meta.arg; state.activeRequestId = action.meta.requestId; }).addCase(lookupPatientByPhone.fulfilled, (state, action) => { if (action.meta.requestId !== state.activeRequestId) return; state.loading = false; state.matches = action.payload; }).addCase(lookupPatientByPhone.rejected, (state, action) => { if (action.meta.requestId !== state.activeRequestId) return; state.loading = false; state.matches = []; state.error = "Patient lookup unavailable"; }) });
export const { clearLookup } = patientLookupSlice.actions;
export default patientLookupSlice.reducer;
