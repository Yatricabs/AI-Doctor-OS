// Deterministic emergency-pathway keyword check. Intentionally NOT AI-based —
// a safety-critical check must never depend on an optional third-party AI
// service being reachable, configured, or correct. Shared between the client
// (for instant chat feedback) and the server (as the authoritative check at
// save time) so both always agree.

export const RED_FLAG_KEYWORDS = [
  "chest pain", "breathless", "shortness of breath", "severe bleeding", "unconscious",
  "unresponsive", "fainting", "stroke", "slurred speech", "suicidal", "seizure",
  "severe allergic reaction", "anaphylaxis", "blood in stool", "blood in vomit",
  "coughing blood", "vomiting blood", "severe dehydration", "can't keep water down",
  "high fever with stiff neck", "unable to breathe", "poisoning", "snake bite",
];

export function detectRedFlags(text: string): string[] {
  const lower = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter((keyword) => lower.includes(keyword));
}
