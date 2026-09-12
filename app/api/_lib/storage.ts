// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage helper (server-side). Uses the service_role key to upload
// patient report files to a PRIVATE bucket and to mint short-lived signed URLs so
// a doctor can view a file without the bucket ever being public.
//
// Plain REST (no supabase-js) to stay dependency-light on serverless, consistent
// with the rest of the data layer.
// ─────────────────────────────────────────────────────────────────────────────

export const REPORTS_BUCKET = "patient-reports";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function cfg(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageNotConfiguredError();
  return { url, key };
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
    this.name = "StorageNotConfiguredError";
  }
}

export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isAllowedReportType(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function extensionFor(mime: string): string {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" }[mime] ?? "bin";
}

/**
 * Uploads bytes to the private reports bucket at `path` and returns that path.
 * Enforces MIME allowlist and size limit server-side (defence in depth).
 */
export async function uploadReport(path: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  if (!isAllowedReportType(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}. Allowed: PNG, JPG, WEBP, PDF.`);
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("File is too large (max 20 MB).");
  }
  const { url, key } = cfg();
  const res = await fetch(`${url}/storage/v1/object/${REPORTS_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return path;
}

/** Mints a signed URL (absolute) for a private object, valid for `expiresIn` seconds. */
export async function signedReportUrl(path: string, expiresIn = 3600): Promise<string> {
  const { url, key } = cfg();
  const res = await fetch(`${url}/storage/v1/object/sign/${REPORTS_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Signed URL failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error("Signed URL missing in response.");
  // The API returns a path like "/object/sign/..."; make it absolute.
  return `${url}/storage/v1${data.signedURL}`;
}
