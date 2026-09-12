// Patient report upload + private read.
//   POST (multipart): file + patientId (+ optional title/type) -> uploads to the
//        private Supabase Storage bucket and creates a report DB record.
//   GET  ?id=<reportId>: returns a short-lived signed URL so a doctor can view it.
import { error, generateId, insert, json, nowIso, patientById, queryOne, readObject, requiredString, safeRoute, update } from "../../_lib/demo";
import { uploadReport, signedReportUrl, storageConfigured, isAllowedReportType, extensionFor } from "../../_lib/storage";

export const dynamic = "force-dynamic";

export const POST = safeRoute(async (request: Request) => {
  if (!storageConfigured()) return error("File storage is not configured on the server.", 503);

  const form = await request.formData().catch(() => null);
  if (!form) return error("Expected multipart/form-data with a file.");

  const file = form.get("file");
  const patientId = String(form.get("patientId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const type = String(form.get("type") ?? "Lab report").trim();

  if (!(file instanceof File)) return error("A file is required.");
  if (!patientId) return error("patientId is required.");
  if (!(await patientById(patientId))) return error("Patient not found.", 404);
  if (!isAllowedReportType(file.type)) return error("Unsupported file type. Allowed: PNG, JPG, WEBP, PDF.");

  const reportId = generateId("report");
  const ext = extensionFor(file.type);
  const path = `${patientId}/${reportId}.${ext}`;

  const bytes = await file.arrayBuffer();
  await uploadReport(path, bytes, file.type);

  await insert("reports", {
    id: reportId,
    patientId,
    title: title || file.name || "Uploaded report",
    type: ["Lab report", "Prescription", "Referral"].includes(type) ? type : "Lab report",
    date: new Date().toISOString().slice(0, 10),
    status: "Ready for review",
    fileName: file.name,
    fileSize: file.size,
    storagePath: path,
  });

  return json({ report: { id: reportId, patientId, title: title || file.name, type, storagePath: path } }, 201);
});

export const GET = safeRoute(async (request: Request) => {
  if (!storageConfigured()) return error("File storage is not configured on the server.", 503);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("id is required.");
  const report = await queryOne<{ storagePath?: string }>("SELECT storage_path FROM reports WHERE id = ?", [id]);
  if (!report?.storagePath) return error("Report file not found.", 404);
  const url = await signedReportUrl(report.storagePath, 3600);
  return json({ url });
});

// Store AI vision findings against a report (called after browser-side analysis).
export const PATCH = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");
  const reportId = requiredString(body.reportId, "reportId", 120);
  const findings = requiredString(body.findings, "findings", 8000);
  if (!reportId || !findings) return error("reportId and findings are required.");
  await update("reports", reportId, { aiFindings: findings });
  return json({ ok: true });
});
