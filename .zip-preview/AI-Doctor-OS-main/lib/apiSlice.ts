import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  Appointment, BillingTransaction, Medicine, Patient, PreVisitReport, Prescription, Report, Service,
} from "@/components/ops/shared";

// Every route handler in this app wraps its response as { ok, data, error }.
// This custom baseQuery unwraps that envelope once, here, so every endpoint
// below can declare its real response type instead of the envelope type.
const envelopeBaseQuery = fetchBaseQuery({ baseUrl: "/api" });
const baseQuery: typeof envelopeBaseQuery = async (args, api, extraOptions) => {
  const result = await envelopeBaseQuery(args, api, extraOptions);
  if (result.error) return result;
  const envelope = result.data as { ok: boolean; data?: unknown; error?: { message: string } };
  if (!envelope?.ok) return { error: { status: "CUSTOM_ERROR", error: envelope?.error?.message || "Request failed." } as never };
  return { data: envelope.data };
};

export type ProfileSettings = { fullName: string; specialty: string; clinicBio: string; availableToday: boolean; notifications: { urgentFollowUps: boolean; weeklySummary: boolean; twoStepSignIn: boolean } };
export type DashboardSummary = {
  date: string;
  appointments: { total: number; new: number; followUp: number; urgent: number; estimatedMinutes: number };
  revenue: { today: number; byType: { type: string; amount: number }[] };
  patients: { total: number };
  inventory: { lowStockCount: number; lowStock: Medicine[] };
  alerts: { openCount: number; items: { id: string; title: string; detail: string; patientName?: string }[] };
};
export type Patient360 = { patient: Patient; appointments: Appointment[]; reports: Report[]; prescriptions: Prescription[]; billing: { transactions: BillingTransaction[]; total: number }; aiSummary: PreVisitReport | null; nextFollowUp: { date: string; time: string } | null };
export type InboxItem = { id: string; type: string; title: string; detail: string; patientId?: string; patientName?: string; status: string; createdAt: string };
export type Insight = { id: string; title: string; detail: string; priority: string; status?: string };
export type ScribeNote = { id: string; patientId: string | null; status: string; subjective: string; objective: string; assessment: string; plan: string; disclaimer?: string };
export type StockTransaction = { id: string; medicineId: string; medicineName: string; type: string; quantity: number; note?: string; createdAt: string };

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Patients", "Patient360", "Appointments", "Medicines", "Services", "Billing", "Dashboard", "Reports", "Prescriptions", "Inbox", "ScribeNotes", "Insights", "Profile"],
  endpoints: (builder) => ({
    // --- Patients ---
    getPatients: builder.query<{ patients: Patient[]; total: number }, { q?: string } | void>({
      query: (params) => ({ url: "/patients", params: params?.q ? { q: params.q } : undefined }),
      providesTags: ["Patients"],
    }),
    addPatient: builder.mutation<{ patient: Patient }, Partial<Patient>>({
      query: (body) => ({ url: "/patients", method: "POST", body }),
      invalidatesTags: ["Patients", "Dashboard"],
    }),
    getPatient360: builder.query<Patient360, string>({
      query: (patientId) => ({ url: "/patients/360", params: { patientId } }),
      providesTags: (_result, _error, patientId) => [{ type: "Patient360", id: patientId }],
    }),

    // --- Appointments ---
    getAppointments: builder.query<{ appointments: Appointment[]; total: number }, { date?: string } | void>({
      query: (params) => ({ url: "/appointments", params: params?.date ? { date: params.date } : undefined }),
      providesTags: ["Appointments"],
    }),
    createAppointment: builder.mutation<{ appointment: Appointment }, Record<string, unknown>>({
      query: (body) => ({ url: "/appointments", method: "POST", body }),
      invalidatesTags: ["Appointments", "Dashboard", "Patient360"],
    }),
    submitPatientIntake: builder.mutation<{ patient: Patient; appointment: Appointment; urgent: boolean }, Record<string, unknown>>({
      query: (body) => ({ url: "/patient-intake", method: "POST", body }),
      invalidatesTags: ["Patients", "Appointments", "Dashboard", "Billing", "Inbox"],
    }),

    // --- Inventory: medicines ---
    getMedicines: builder.query<{ medicines: Medicine[]; transactions: StockTransaction[] }, void>({
      query: () => "/inventory/medicines",
      providesTags: ["Medicines"],
    }),
    addMedicine: builder.mutation<{ medicine: Medicine }, Partial<Medicine>>({
      query: (body) => ({ url: "/inventory/medicines", method: "POST", body }),
      invalidatesTags: ["Medicines", "Dashboard"],
    }),
    updateMedicine: builder.mutation<{ medicine: Medicine }, { id: string } & Record<string, unknown>>({
      query: (body) => ({ url: "/inventory/medicines", method: "PATCH", body }),
      invalidatesTags: ["Medicines", "Dashboard"],
    }),
    deleteMedicine: builder.mutation<{ deleted: string }, string>({
      query: (id) => ({ url: "/inventory/medicines", method: "DELETE", params: { id } }),
      invalidatesTags: ["Medicines", "Dashboard"],
    }),

    // --- Inventory: services (tests/scans/procedures) ---
    getServices: builder.query<{ services: Service[] }, void>({
      query: () => "/inventory/services",
      providesTags: ["Services"],
    }),
    addService: builder.mutation<{ service: Service }, Partial<Service>>({
      query: (body) => ({ url: "/inventory/services", method: "POST", body }),
      invalidatesTags: ["Services"],
    }),
    updateService: builder.mutation<{ service: Service }, { id: string } & Record<string, unknown>>({
      query: (body) => ({ url: "/inventory/services", method: "PATCH", body }),
      invalidatesTags: ["Services"],
    }),
    deleteService: builder.mutation<{ deleted: string }, string>({
      query: (id) => ({ url: "/inventory/services", method: "DELETE", params: { id } }),
      invalidatesTags: ["Services"],
    }),

    // --- Billing ---
    getBilling: builder.query<{ transactions: BillingTransaction[]; total: number; count: number }, { patientId?: string; date?: string } | void>({
      query: (params) => ({ url: "/billing", params: params ? { ...(params.patientId ? { patientId: params.patientId } : {}), ...(params.date ? { date: params.date } : {}) } : undefined }),
      providesTags: ["Billing"],
    }),
    addBillingTransaction: builder.mutation<{ transaction: BillingTransaction }, Record<string, unknown>>({
      query: (body) => ({ url: "/billing", method: "POST", body }),
      invalidatesTags: ["Billing", "Medicines", "Dashboard", "Patient360"],
    }),

    // --- Dashboard ---
    getDashboardSummary: builder.query<{ summary: DashboardSummary }, { date?: string } | void>({
      query: (params) => ({ url: "/dashboard/summary", params: params?.date ? { date: params.date } : undefined }),
      providesTags: ["Dashboard"],
    }),

    // --- Reports & Documents ---
    getReports: builder.query<{ reports: Report[]; total: number }, { patientId?: string } | void>({
      query: (params) => ({ url: "/medical-records/reports", params: params?.patientId ? { patientId: params.patientId } : undefined }),
      providesTags: ["Reports"],
    }),
    addReport: builder.mutation<{ report: Report }, Record<string, unknown>>({
      query: (body) => ({ url: "/medical-records/reports", method: "POST", body }),
      invalidatesTags: ["Reports", "Patient360"],
    }),
    summarizeReport: builder.mutation<{ summary: unknown }, Record<string, unknown>>({
      query: (body) => ({ url: "/medical-records/summarize", method: "POST", body }),
    }),
    analyzeReport: builder.mutation<{ analysis: unknown }, Record<string, unknown>>({
      query: (body) => ({ url: "/medical-records/analyze", method: "POST", body }),
    }),

    // --- Prescriptions & Safety Engine ---
    getPrescriptions: builder.query<{ prescriptions: Prescription[] }, { patientId?: string } | void>({
      query: (params) => ({ url: "/prescriptions", params: params?.patientId ? { patientId: params.patientId } : undefined }),
      providesTags: ["Prescriptions"],
    }),
    draftPrescription: builder.mutation<{ prescription: Prescription }, Record<string, unknown>>({
      query: (body) => ({ url: "/prescriptions", method: "POST", body }),
      invalidatesTags: ["Prescriptions"],
    }),
    updatePrescription: builder.mutation<{ prescription: Prescription }, Record<string, unknown>>({
      query: (body) => ({ url: "/prescriptions", method: "PATCH", body }),
      invalidatesTags: ["Prescriptions"],
    }),

    // --- AI Inbox ---
    getInbox: builder.query<{ items: InboxItem[]; total: number }, void>({
      query: () => "/inbox",
      providesTags: ["Inbox"],
    }),
    resolveInboxItem: builder.mutation<{ item: InboxItem }, string>({
      query: (id) => ({ url: "/inbox", method: "PATCH", body: { id } }),
      invalidatesTags: ["Inbox", "Dashboard"],
    }),

    // --- AI Scribe ---
    getScribeNotes: builder.query<{ notes: ScribeNote[] }, { patientId?: string } | void>({
      query: (params) => ({ url: "/scribe", params: params?.patientId ? { patientId: params.patientId } : undefined }),
      providesTags: ["ScribeNotes"],
    }),
    createScribeNote: builder.mutation<{ note: ScribeNote; aiGenerated: boolean }, Record<string, unknown>>({
      query: (body) => ({ url: "/scribe", method: "POST", body }),
      invalidatesTags: ["ScribeNotes"],
    }),
    updateScribeNote: builder.mutation<{ note: ScribeNote }, Record<string, unknown>>({
      query: (body) => ({ url: "/scribe", method: "PATCH", body }),
      invalidatesTags: ["ScribeNotes"],
    }),

    // --- Copilot & Symptom checker (deferred Doctor Workspace surfaces — client-side AI) ---
    askCopilot: builder.mutation<{ response: string; aiGenerated: boolean }, Record<string, unknown>>({
      query: (body) => ({ url: "/copilot", method: "POST", body }),
    }),
    analyzeSymptoms: builder.mutation<{ analysis: Record<string, unknown> }, Record<string, unknown>>({
      query: (body) => ({ url: "/symptom-analysis", method: "POST", body }),
    }),

    // --- Clinical insights ---
    getInsights: builder.query<{ insights: Insight[] }, void>({
      query: () => "/insights",
      providesTags: ["Insights"],
    }),

    // --- Profile / Settings ---
    getProfile: builder.query<{ settings: ProfileSettings }, void>({
      query: () => "/profile/settings",
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<{ settings: ProfileSettings }, Partial<ProfileSettings>>({
      query: (body) => ({ url: "/profile/settings", method: "PATCH", body }),
      invalidatesTags: ["Profile", "Dashboard"],
    }),
  }),
});

export const {
  useGetPatientsQuery, useAddPatientMutation, useGetPatient360Query,
  useGetAppointmentsQuery, useCreateAppointmentMutation, useSubmitPatientIntakeMutation,
  useGetMedicinesQuery, useAddMedicineMutation, useUpdateMedicineMutation, useDeleteMedicineMutation,
  useGetServicesQuery, useAddServiceMutation, useUpdateServiceMutation, useDeleteServiceMutation,
  useGetBillingQuery, useAddBillingTransactionMutation,
  useGetDashboardSummaryQuery,
  useGetReportsQuery, useAddReportMutation, useSummarizeReportMutation, useAnalyzeReportMutation,
  useGetPrescriptionsQuery, useDraftPrescriptionMutation, useUpdatePrescriptionMutation,
  useGetInboxQuery, useResolveInboxItemMutation,
  useGetScribeNotesQuery, useCreateScribeNoteMutation, useUpdateScribeNoteMutation,
  useAskCopilotMutation, useAnalyzeSymptomsMutation,
  useGetInsightsQuery,
  useGetProfileQuery, useUpdateProfileMutation,
} = api;
