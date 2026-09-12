// Detailed pre-visit summary for the doctor: the patient's full story assembled
// from their intake conversation + any uploaded reports (with AI-read findings
// and a short-lived signed link to the ACTUAL file). Read-only, review-required.
//
// GET ?patientId=<id> -> { patient, story, reports[] }
import { error, getPatientContext, json, query, queryOne, safeRoute, type Report } from "../../_lib/demo";
import { signedReportUrl, storageConfigured } from "../../_lib/storage";

export const dynamic = "force-dynamic";

type StoryTurn = { question: string; answer: string; kind: string };

type ReportView = {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  fileName?: string;
  findings: ParsedFindings | null;
  fileUrl: string | null; // signed, 1h — null if storage not configured / no file
};

type ParsedFindings = {
  documentType: string;
  overallImpression: string;
  abnormal: string[];
  normal: string[];
  medications: string[];
  followUpFocus: string;
  reviewNote: string;
};

function parseFindings(raw?: string): ParsedFindings | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
    return {
      documentType: String(o.documentType ?? ""),
      overallImpression: String(o.overallImpression ?? ""),
      abnormal: arr(o.abnormal),
      normal: arr(o.normal),
      medications: arr(o.medications),
      followUpFocus: String(o.followUpFocus ?? ""),
      reviewNote: String(o.reviewNote ?? ""),
    };
  } catch {
    return null;
  }
}

export const GET = safeRoute(async (request: Request) => {
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) return error("patientId is required");

  const context = await getPatientContext(patientId);
  if (!context) return error("Patient not found", 404);

  // ── The AI-generated pre-visit report (with internet research) from intake ──
  const aiBrief = await queryOne<{ aiReport?: string; research?: string; aiConsiderations?: string; attentionSignals?: string; createdAt?: string }>(
    "SELECT * FROM pre_visit_briefs WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1",
    [patientId]
  );
  const parseStrArr = (v?: string): string[] => {
    if (!v) return [];
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map((x) => String(x)).filter(Boolean) : []; } catch { return []; }
  };
  const parseSignals = (v?: string): string[] => {
    if (!v) return [];
    try {
      const p = JSON.parse(v);
      if (!Array.isArray(p)) return [];
      return p.map((s) => (s && typeof s === "object" ? String((s as { detail?: string }).detail ?? "") : String(s))).filter(Boolean);
    } catch { return []; }
  };
  const aiReport = {
    summary: aiBrief?.aiReport ?? "",
    research: aiBrief?.research ?? "",
    considerations: parseStrArr(aiBrief?.aiConsiderations),
    redFlags: parseSignals(aiBrief?.attentionSignals),
  };

  // ── The intake conversation: chief complaint, history, meds, tests, etc. ──
  const session = await queryOne<{ id: string; visitType?: string; status?: string; createdAt?: string }>(
    "SELECT * FROM intake_sessions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1",
    [patientId]
  );

  const story: StoryTurn[] = [];
  let preVisitBrief = "";
  if (session) {
    const rows = await query<{ questionText?: string; responseValue?: string; responseType?: string; questionKey?: string }>(
      "SELECT * FROM intake_responses WHERE intake_session_id = ? ORDER BY created_at ASC",
      [session.id]
    );
    for (const r of rows) {
      const value = String(r.responseValue ?? "");
      if (!value || value === "__skipped__") continue;
      if (r.questionKey === "pre_visit_brief" || r.responseType === "brief") {
        preVisitBrief = value;
        continue;
      }
      story.push({
        question: String(r.questionText ?? r.questionKey ?? ""),
        answer: value,
        kind: String(r.responseType ?? "chat"),
      });
    }
  }

  // ── Uploaded reports: findings + a fresh signed link to the real file. ──
  const reportRows = await query<Report>(
    "SELECT * FROM reports WHERE patient_id = ? ORDER BY date DESC, created_at DESC",
    [patientId]
  );
  const canSign = storageConfigured();
  const reports: ReportView[] = [];
  for (const r of reportRows) {
    let fileUrl: string | null = null;
    if (canSign && r.storagePath) {
      try {
        fileUrl = await signedReportUrl(r.storagePath, 3600);
      } catch {
        fileUrl = null; // signing is best-effort; the doctor still sees findings
      }
    }
    reports.push({
      id: r.id,
      title: r.title,
      type: r.type,
      date: r.date,
      status: r.status,
      fileName: r.fileName,
      findings: parseFindings(r.aiFindings),
      fileUrl,
    });
  }

  // Roll up an at-a-glance list of everything flagged abnormal across reports.
  const abnormalHighlights = reports.flatMap((r) => r.findings?.abnormal ?? []);

  return json({
    patient: context.patient,
    context: {
      medications: context.medications,
      allergies: context.allergies,
      conditions: context.conditions,
      followUps: context.followUps,
    },
    intake: {
      hasSession: Boolean(session),
      completed: session?.status === "completed",
      story,
      preVisitBrief,
    },
    aiReport,
    reports,
    abnormalHighlights,
    disclaimer:
      "AI-assisted pre-visit summary. Report values were transcribed by AI and must be verified against the original documents. The clinician decides all diagnoses and treatment.",
  });
});
