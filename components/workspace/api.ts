// Shared { ok, data } fetch helper for workspace screens.
"use client";

type Envelope<T> = { ok: boolean; data?: T; error?: { message: string } };

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const payload = (await res.json()) as Envelope<T>;
  if (!res.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }
  return payload.data;
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await res.json()) as Envelope<T>;
  if (!res.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }
  return payload.data;
}
