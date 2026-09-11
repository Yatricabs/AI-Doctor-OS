import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");

  let sql = `SELECT r.*, p.name as patient_name, p.initials as patient_initials
             FROM referrals r JOIN patients p ON r.patient_id = p.id WHERE 1=1`;
  const params: unknown[] = [];
  if (patientId) { sql += " AND r.patient_id = ?"; params.push(patientId); }
  if (status) { sql += " AND r.status = ?"; params.push(status); }
  sql += " ORDER BY CASE r.urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END, r.created_at DESC";

  const referrals = query<Record<string, unknown>>(sql, params);
  return json({ referrals, total: referrals.length });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action") ?? "create";

  if (action === "create") {
    const patientId = requiredString(body.patientId, "patientId");
    const specialty = requiredString(body.referredToSpecialty, "referredToSpecialty");
    const reason = requiredString(body.reason, "reason");
    if (!patientId || !specialty || !reason) return error("patientId, referredToSpecialty, and reason are required");

    const patient = queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return error("Patient not found", 404);

    // Build referral package
    const context = {
      patient: { name: patient.name, dob: patient.dateOfBirth, gender: patient.gender, bloodGroup: patient.bloodGroup },
      referralReason: reason,
      urgency: typeof body.urgency === "string" ? body.urgency : "routine",
    };

    const referral = {
      id: generateId("ref"),
      patientId,
      visitId: typeof body.visitId === "string" ? body.visitId : null,
      referringDoctorId: "user-doc-001",
      referredToSpecialty: specialty,
      referredToDoctor: typeof body.referredToDoctor === "string" ? body.referredToDoctor : null,
      referredToFacility: typeof body.referredToFacility === "string" ? body.referredToFacility : null,
      reason,
      urgency: typeof body.urgency === "string" ? body.urgency : "routine",
      status: "pending",
      notes: typeof body.notes === "string" ? body.notes : null,
      referralPackage: JSON.stringify(context),
      createdAt: nowIso(),
    };
    insert("referrals", referral);

    // Create inbox item
    insert("inbox_items", {
      id: generateId("inbox"),
      patientId,
      category: "referral",
      title: `Referral pending: ${specialty}`,
      detail: `Referral for ${patient.name} to ${specialty}. Urgency: ${referral.urgency}. Reason: ${reason}`,
      priority: referral.urgency === "emergency" ? "urgent" : referral.urgency === "urgent" ? "high" : "medium",
      status: "open",
      source: "referral_engine",
      actionRequired: "Complete and send referral package",
      createdAt: nowIso(),
    });

    return json({ referral: { ...referral, referralPackage: context }, patient }, 201);
  }

  if (action === "update_status") {
    const referralId = requiredString(body.referralId, "referralId");
    const newStatus = requiredString(body.status, "status");
    if (!referralId || !newStatus) return error("referralId and status are required");
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "accepted") updates.acceptedAt = nowIso();
    if (newStatus === "completed") updates.completedAt = nowIso();
    update("referrals", referralId, updates);
    const updated = queryOne<Record<string, unknown>>("SELECT * FROM referrals WHERE id = ?", [referralId]);
    return json({ referral: updated });
  }

  return error("Unknown action. Use: create, update_status");
}
