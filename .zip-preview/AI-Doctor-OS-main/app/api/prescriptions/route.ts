import {
  KNOWN_ACTIVE_MEDICATIONS,
  KNOWN_ALLERGIES,
  KNOWN_INTERACTIONS,
  Prescription,
  error,
  json,
  optionalString,
  patientById,
  persistPrescription,
  prescriptions,
  readObject,
  requiredString,
} from "../_lib/demo";

export const dynamic = "force-dynamic";

function runSafetyEngine(patientId: string, medication: string): string[] {
  const flags: string[] = [];
  const allergies = KNOWN_ALLERGIES[patientId] ?? [];
  if (allergies.some((allergy) => medication.toLowerCase().includes(allergy.toLowerCase()))) {
    flags.push(`Allergy conflict: patient has a recorded allergy to ${allergies.join(", ")}.`);
  }
  const activeMeds = KNOWN_ACTIVE_MEDICATIONS[patientId] ?? [];
  if (activeMeds.some((med) => med.toLowerCase() === medication.toLowerCase())) {
    flags.push(`Duplication: ${medication} already appears in this patient's active medication list.`);
  }
  const interactions = KNOWN_INTERACTIONS[medication] ?? [];
  const interactingActive = activeMeds.filter((med) => interactions.includes(med));
  if (interactingActive.length > 0) {
    flags.push(`Interaction risk: ${medication} may interact with current medication ${interactingActive.join(", ")}.`);
  }
  return flags;
}

export function GET(request: Request) {
  const patientId = new URL(request.url).searchParams.get("patientId");
  const data = (prescriptions as unknown as Prescription[]).filter((item) => !patientId || item.patientId === patientId);
  return json({ prescriptions: data });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const patientId = requiredString(body.patientId, "patientId", 30);
  if (!patientId) return error("patientId is required.");
  const patient = patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  const medication = requiredString(body.medication, "medication", 100);
  if (!medication) return error("medication is required.");
  const dosage = optionalString(body.dosage, 100) ?? "As directed";
  const flags = runSafetyEngine(patientId, medication);
  const prescription: Prescription = {
    id: `rx-${Date.now()}`,
    patientId,
    patientName: patient.name,
    medication,
    dosage,
    status: flags.length > 0 ? "NEEDS_REVIEW" : "SAFETY_CHECK",
    safetyFlags: flags,
    createdAt: new Date().toISOString(),
  };
  prescriptions.push(prescription);
  return json({ prescription }, 201);
}

export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const id = requiredString(body.id, "id", 60);
  if (!id) return error("id is required.");
  const existing = (prescriptions as unknown as Prescription[]).find((item) => item.id === id);
  if (!existing) return error("Prescription not found.", 404);
  const action = requiredString(body.action, "action", 20);
  if (!action || !["approve", "dispatch", "override"].includes(action)) return error("action must be one of approve, dispatch, override.");

  if (action === "override") {
    const reason = requiredString(body.overrideReason, "overrideReason", 300);
    if (!reason) return error("overrideReason is required to override a safety flag.");
    persistPrescription(id, { status: "APPROVED", overrideReason: reason });
    return json({ prescription: { ...existing, status: "APPROVED", overrideReason: reason } });
  }
  if (action === "approve") {
    if (existing.safetyFlags.length > 0) return error("This prescription has unresolved safety flags. Use override with a reason, or change the medication.", 409);
    persistPrescription(id, { status: "APPROVED" });
    return json({ prescription: { ...existing, status: "APPROVED" } });
  }
  if (action === "dispatch") {
    if (existing.status !== "APPROVED") return error("Only an approved prescription can be dispatched.", 409);
    persistPrescription(id, { status: "DISPATCHED" });
    return json({ prescription: { ...existing, status: "DISPATCHED" } });
  }
  return error("Unhandled action.");
}
