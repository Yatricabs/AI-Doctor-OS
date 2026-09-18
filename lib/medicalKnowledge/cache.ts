import type { EvidenceContext } from "./types.ts";

type Entry = { expiresAt: number; value: EvidenceContext };
const entries = new Map<string, Entry>();
const TTL_MS = 10 * 60 * 1000;

export function readEvidenceCache(key: string): EvidenceContext | null {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { entries.delete(key); return null; }
  return { ...entry.value, cacheHit: true };
}

export function writeEvidenceCache(key: string, value: EvidenceContext) {
  entries.set(key, { expiresAt: Date.now() + TTL_MS, value: { ...value, cacheHit: false } });
}

export function clearEvidenceCacheForTests() { entries.clear(); }
