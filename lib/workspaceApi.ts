import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

export type Patient = { id: string; name: string; initials?: string; status?: string; phone?: string; gender?: string; dateOfBirth?: string; patientType?: string; appointment?: string };
export type Appointment = { id: string; patientId: string; patientName?: string; patientInitials?: string; patientPhone?: string; visitType: string; appointmentDate: string; appointmentTime: string; status: string; reason?: string };
export type QueueEntry = { id: string; patientName?: string; tokenNumber?: string; status: string; priority: string };
export type FollowUp = { id: string; title: string; dueDate: string; priority: string; patientId: string };
export type RevenueSummary = { today: { total: number; bills: number }; allTime: { total: number; bills: number }; breakdown: Record<string, number> };
export type InventoryItem = { id: string; name: string; category: "medicine" | "test" | "scan"; unit?: string; price: number; purchasePrice: number; stockQty: number; lowStockThreshold: number; tracksStock: boolean; lowStock: boolean };
export type BillItem = { id: string; itemType: string; description: string; quantity: number; unitPrice: number; amount: number };
export type Bill = { id: string; patientId: string; patientName?: string; total: number; createdAt: string; items: BillItem[] };
export type BillingData = { bills: Bill[]; perPatient: { patientId: string; patientName: string; total: number; bills: number }[]; breakdown: Record<string, number>; grandTotal?: number; total?: number };
export type Context = { patient: Patient; medications: { id: string; name: string; dose?: string; frequency?: string }[]; allergies: { id: string; allergen: string; severity: string; reaction?: string }[]; conditions: { id: string; name: string; status?: string }[]; reports: { id: string; title: string; type: string; date: string; aiFindings?: string }[]; followUps: FollowUp[] };
export type ChatTurn = { role: "assistant" | "user"; content: string };
export type Visit = { appointment: Appointment | null; chat: { id: string; transcript: ChatTurn[]; createdAt: string } | null; prescription: { id: string; status?: string; notes?: string; items: { medicationName?: string; dose?: string; frequency?: string; duration?: string }[] } | null };
export type Summary = { intake: { preVisitBrief: string; story: { question: string; answer: string }[] }; aiReport?: { summary: string; research: string; considerations: string[]; redFlags: string[]; structured?: { treatmentMedicines?: string[]; testsInitial?: string[]; treatmentMeasures?: string[] } & Record<string, unknown> | null }; reports: { id: string; title: string; findings: { overallImpression: string; abnormal: string[] } | null }[]; abnormalHighlights: string[] };
export type QueueData = { queue: { entries: QueueEntry[]; waiting: number; urgent: number; total?: number } };
export type NextIntake = { sessionId: string; stepId?: string; question?: string; options?: string[]; emergency?: boolean; done: boolean; closing?: string };
export type AppointmentList = { appointments: Appointment[] };
export type PatientLookup = { found: boolean; patient: Patient | null; recentAppointments?: { appointmentDate?: string; appointmentTime?: string; reason?: string; status?: string }[] };
export type FollowUpList = { followUps: FollowUp[]; overdueFollowUps?: FollowUp[]; total?: number; overdueCount?: number };
export type InboxData = { items: Record<string, unknown>[]; total: number; urgentCount: number; highCount: number };
export type ReportUpload = { report?: { id: string } };

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };
const rawBaseQuery = fetchBaseQuery({ baseUrl: "/", prepareHeaders: (headers) => { headers.set("Content-Type", "application/json"); return headers; } });

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const request = typeof args === "string" ? undefined : args;
  if (request?.body instanceof FormData) {
    const headers = new Headers(request.headers as HeadersInit | undefined);
    headers.delete("Content-Type");
    args = { ...request, headers };
  }
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) return result;
  const payload = result.data as Envelope<unknown>;
  if (!payload?.ok || payload.data === undefined) return { error: { status: 400, data: payload?.error?.message ?? "Request failed." } };
  return { data: payload.data };
};

export const workspaceApi = createApi({
  reducerPath: "workspaceApi",
  baseQuery,
  tagTypes: ["Patients", "Patient", "Appointments", "Appointment", "Chat", "Reports", "Prescriptions", "Inventory", "Billing", "FollowUps", "Queue", "Dashboard"],
  endpoints: (builder) => ({
    getPatients: builder.query<{ patients: Patient[]; total: number }, void>({ query: () => "api/patients", providesTags: ["Patients"] }),
    getPatientContext: builder.query<Context, string>({ query: (patientId) => `api/patients/context?patientId=${encodeURIComponent(patientId)}`, providesTags: (_r, _e, id) => [{ type: "Patient", id }, "Reports", "FollowUps", "Chat", "Billing"] }),
    getAppointments: builder.query<{ appointments: Appointment[] }, string | void>({ query: (date) => date ? `api/appointments?date=${encodeURIComponent(date)}` : "api/appointments", providesTags: ["Appointments"] }),
    getPatientVisits: builder.query<{ visits: Visit[] }, string>({ query: (patientId) => `api/appointments/chat?patientId=${encodeURIComponent(patientId)}`, providesTags: (_r, _e, id) => [{ type: "Chat", id }] }),
    getPatientSummary: builder.query<Summary, string>({ query: (patientId) => `api/pre-visit/summary?patientId=${encodeURIComponent(patientId)}`, providesTags: (_r, _e, id) => [{ type: "Reports", id }] }),
    getPreVisitBrief: builder.query<Record<string, unknown>, string>({ query: (patientId) => `api/pre-visit?patientId=${encodeURIComponent(patientId)}`, providesTags: (_r, _e, id) => [{ type: "Reports", id }] }),
    getPreVisitSummary: builder.query<Record<string, unknown>, string>({ query: (patientId) => `api/pre-visit/summary?patientId=${encodeURIComponent(patientId)}`, providesTags: (_r, _e, id) => [{ type: "Reports", id }] }),
    getQueue: builder.query<{ queue: { entries: QueueEntry[]; waiting: number; urgent: number } }, void>({ query: () => "api/queue", providesTags: ["Queue"] }),
    getFollowUps: builder.query<{ followUps?: FollowUp[]; overdueFollowUps?: FollowUp[] }, void>({ query: () => "api/follow-ups", providesTags: ["FollowUps"] }),
    getBilling: builder.query<BillingData, string | void>({ query: (patientId) => patientId ? `api/billing?patientId=${encodeURIComponent(patientId)}` : "api/billing", providesTags: (_r, _e, id) => id ? [{ type: "Billing", id }] : ["Billing"] }),
    getRevenueSummary: builder.query<RevenueSummary, void>({ query: () => "api/billing?summary=1", providesTags: ["Billing", "Dashboard"] }),
    getInventory: builder.query<{ items: InventoryItem[]; total: number }, string | void>({ query: (category) => category ? `api/inventory?category=${encodeURIComponent(category)}` : "api/inventory", providesTags: ["Inventory"] }),
    createPatient: builder.mutation<{ patient: Patient; existing?: boolean }, Record<string, unknown>>({ query: (body) => ({ url: "api/patients", method: "POST", body }), invalidatesTags: ["Patients"] }),
    createBill: builder.mutation<unknown, Record<string, unknown>>({ query: (body) => ({ url: "api/billing", method: "POST", body }), invalidatesTags: ["Billing", "Inventory", "Dashboard", "Patient"] }),
    saveInventory: builder.mutation<unknown, { method: "POST" | "PATCH"; body: Record<string, unknown> }>({ query: ({ method, body }) => ({ url: "api/inventory", method, body }), invalidatesTags: ["Inventory", "Billing", "Dashboard"] }),
    deleteInventory: builder.mutation<unknown, string>({ query: (id) => ({ url: `api/inventory?id=${encodeURIComponent(id)}`, method: "DELETE" }), invalidatesTags: ["Inventory", "Billing", "Dashboard"] }),
    createPrescription: builder.mutation<{ prescription: { id: string } }, Record<string, unknown>>({ query: (body) => ({ url: "api/prescriptions", method: "POST", body }), invalidatesTags: ["Prescriptions", "Patient", "Inventory", "Billing", "Dashboard"] }),
    lookupPatient: builder.query<PatientLookup, string>({ query: (phone) => `api/patients?phone=${encodeURIComponent(phone)}` }),
    getAppointmentsByPatient: builder.query<AppointmentList, string>({ query: (patientId) => `api/appointments?patientId=${encodeURIComponent(patientId)}`, providesTags: ["Appointments"] }),
    createAppointment: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/appointments", method: "POST", body }), invalidatesTags: ["Appointments", "Patient", "Queue"] }),
    getQueueForClinic: builder.query<QueueData, string | void>({ query: (clinicId) => `api/queue?clinicId=${encodeURIComponent(clinicId ?? "clinic-001")}`, providesTags: ["Queue"] }),
    queueAction: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/queue", method: "POST", body }), invalidatesTags: ["Queue", "Appointments", "Patient"] }),
    checkInPatient: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/queue", method: "POST", body }), invalidatesTags: ["Queue", "Appointments", "Patient"] }),
    getFollowUpsFiltered: builder.query<FollowUpList, { status?: string; overdue?: boolean }>({ query: ({ status, overdue }) => `api/follow-ups?${overdue ? "overdue=true" : `status=${encodeURIComponent(status ?? "pending")}`}`, providesTags: ["FollowUps"] }),
    followUpAction: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/follow-ups", method: "POST", body }), invalidatesTags: ["FollowUps", "Patient"] }),
    getMorningBrief: builder.query<Record<string, unknown>, void>({ query: () => "api/briefs/morning", providesTags: ["Dashboard", "Appointments", "Queue", "FollowUps"] }),
    getInbox: builder.query<InboxData, string | void>({ query: (category) => category ? `api/inbox?category=${encodeURIComponent(category)}` : "api/inbox", providesTags: ["Dashboard"] }),
    inboxAction: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/inbox", method: "POST", body }), invalidatesTags: ["Dashboard"] }),
    getAnalytics: builder.query<Record<string, unknown>, string>({ query: (range) => `api/analytics?range=${encodeURIComponent(range)}`, providesTags: ["Dashboard"] }),
    intakeNext: builder.mutation<NextIntake, Record<string, unknown>>({ query: (body) => ({ url: "api/intake/next", method: "POST", body }) }),
    intakeAction: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/intake", method: "POST", body }) }),
    savePreVisit: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/pre-visit", method: "POST", body }), invalidatesTags: ["Reports", "Patient"] }),
    saveVisitTranscript: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/appointments/chat", method: "POST", body }), invalidatesTags: ["Chat", "Patient"] }),
    uploadReport: builder.mutation<ReportUpload, FormData>({ query: (body) => ({ url: "api/reports/upload", method: "POST", body }), invalidatesTags: ["Reports", "Patient"] }),
    updateReport: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/reports/upload", method: "PATCH", body }), invalidatesTags: ["Reports", "Patient"] }),
    prescriptionAction: builder.mutation<Record<string, unknown>, Record<string, unknown>>({ query: (body) => ({ url: "api/prescriptions", method: "POST", body }), invalidatesTags: ["Prescriptions", "Patient", "Inventory", "Billing", "Dashboard"] }),
  }),
});

export const { useGetPatientsQuery, useGetPatientContextQuery, useGetAppointmentsQuery, useGetPatientVisitsQuery, useGetPatientSummaryQuery, useGetPreVisitBriefQuery, useGetPreVisitSummaryQuery, useGetQueueQuery, useGetFollowUpsQuery, useGetBillingQuery, useGetRevenueSummaryQuery, useGetInventoryQuery, useCreatePatientMutation, useCreateBillMutation, useSaveInventoryMutation, useDeleteInventoryMutation, useCreatePrescriptionMutation, useLookupPatientQuery, useLazyLookupPatientQuery, useGetAppointmentsByPatientQuery, useCreateAppointmentMutation, useGetQueueForClinicQuery, useQueueActionMutation, useCheckInPatientMutation, useGetFollowUpsFilteredQuery, useFollowUpActionMutation, useGetMorningBriefQuery, useGetInboxQuery, useInboxActionMutation, useGetAnalyticsQuery, useIntakeNextMutation, useIntakeActionMutation, useSavePreVisitMutation, useSaveVisitTranscriptMutation, useUploadReportMutation, useUpdateReportMutation, usePrescriptionActionMutation } = workspaceApi;
