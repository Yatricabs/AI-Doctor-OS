import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const prescriptionId = searchParams.get("id");

  if (prescriptionId) {
    const rx = await queryOne<Record<string, unknown>>("SELECT * FROM prescriptions WHERE id = ?", [prescriptionId]);
    if (!rx) return error("Prescription not found", 404);
    const items = await query<Record<string, unknown>>("SELECT * FROM prescription_items WHERE prescription_id = ?", [prescriptionId]);
    const checks = await query<Record<string, unknown>>("SELECT * FROM safety_checks WHERE prescription_id = ?", [prescriptionId]);
    return json({ prescription: { ...rx, items, safetyChecks: checks } });
  }

  if (patientId) {
    const rxList = await query<Record<string, unknown>>("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC", [patientId]);
    const enriched = await Promise.all(
      rxList.map(async (rx) => ({
        ...rx,
        items: await query<Record<string, unknown>>("SELECT * FROM prescription_items WHERE prescription_id = ?", [rx.id]),
        safetyChecks: await query<Record<string, unknown>>("SELECT * FROM safety_checks WHERE prescription_id = ?", [rx.id]),
      }))
    );
    return json({ prescriptions: enriched });
  }

  return error("patientId or id required");
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action") ?? "create";

  // ── Create draft prescription ──
  if (action === "create" || !body.action) {
    const patientId = requiredString(body.patientId, "patientId");
    if (!patientId) return error("patientId is required");
    const patient = await queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return error("Patient not found", 404);

    const rxId = generateId("rx");
    const prescription = {
      id: rxId,
      patientId,
      visitId: typeof body.visitId === "string" ? body.visitId : null,
      doctorId: "user-doc-001",
      status: "draft",
      notes: typeof body.notes === "string" ? body.notes : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await insert("prescriptions", prescription);

    // Add items
    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    const items: Record<string, unknown>[] = [];
    for (const item of itemsRaw as Record<string, unknown>[]) {
      const row = {
        id: generateId("rxi"),
        prescriptionId: rxId,
        medicationName: String(item.medicationName ?? ""),
        genericName: typeof item.genericName === "string" ? item.genericName : null,
        dose: String(item.dose ?? ""),
        frequency: String(item.frequency ?? ""),
        route: String(item.route ?? "oral"),
        duration: typeof item.duration === "string" ? item.duration : null,
        quantity: typeof item.quantity === "string" ? item.quantity : null,
        instructions: typeof item.instructions === "string" ? item.instructions : null,
        isSubstitutable: item.isSubstitutable !== false ? 1 : 0,
        createdAt: nowIso(),
      };
      await insert("prescription_items", row);
      items.push(row);
    }

    return json({ prescription: { ...prescription, items, safetyChecks: [] } }, 201);
  }

  // ── Run safety checks ──
  if (action === "safety_check") {
    const prescriptionId = requiredString(body.prescriptionId, "prescriptionId");
    if (!prescriptionId) return error("prescriptionId is required");

    const rx = await queryOne<Record<string, unknown>>("SELECT * FROM prescriptions WHERE id = ?", [prescriptionId]);
    if (!rx) return error("Prescription not found", 404);

    const items = await query<Record<string, unknown>>("SELECT * FROM prescription_items WHERE prescription_id = ?", [prescriptionId]);
    const allergies = await query<Record<string, unknown>>("SELECT * FROM allergies WHERE patient_id = ? AND is_active = 1", [rx.patientId]);
    const currentMeds = await query<Record<string, unknown>>("SELECT * FROM medications WHERE patient_id = ? AND status = 'active'", [rx.patientId]);
    const interactionDb = await query<Record<string, unknown>>("SELECT * FROM drug_interactions_db");

    const checks: Record<string, unknown>[] = [];

    // Check allergies
    for (const item of items) {
      const medName = String(item.medicationName ?? "").toLowerCase();
      for (const allergy of allergies) {
        const allergen = String(allergy.allergen ?? "").toLowerCase();
        if (medName.includes(allergen) || allergen.includes(medName.split(" ")[0])) {
          const check = {
            id: generateId("sc"),
            prescriptionId,
            patientId: String(rx.patientId),
            checkType: "allergy",
            medicationA: item.medicationName,
            medicationB: null,
            severity: String(allergy.severity) === "severe" ? "blocked" : String(allergy.severity),
            message: `⚠️ ALLERGY ALERT: ${item.medicationName} — Patient has documented allergy to ${allergy.allergen}. Reaction: ${allergy.reaction ?? "Not specified"}.`,
            recommendation: `DO NOT prescribe ${item.medicationName}. Consider alternative drug class.`,
            isOverridden: 0,
            createdAt: nowIso(),
          };
          await insert("safety_checks", check);
          checks.push(check);
        }
      }
    }

    // Check drug interactions
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const drugA = String(items[i].medicationName ?? "").toLowerCase();
        const drugB = String(items[j].medicationName ?? "").toLowerCase();
        for (const interaction of interactionDb) {
          const iDrugA = String(interaction.drugA ?? "").toLowerCase();
          const iDrugB = String(interaction.drugB ?? "").toLowerCase();
          if ((drugA.includes(iDrugA) || iDrugA.includes(drugA.split(" ")[0])) &&
            (drugB.includes(iDrugB) || iDrugB.includes(drugB.split(" ")[0]))) {
            const check = {
              id: generateId("sc"),
              prescriptionId,
              patientId: String(rx.patientId),
              checkType: "interaction",
              medicationA: items[i].medicationName,
              medicationB: items[j].medicationName,
              severity: interaction.severity,
              message: `⚡ INTERACTION: ${items[i].medicationName} + ${items[j].medicationName} — ${interaction.description}`,
              recommendation: interaction.recommendation,
              isOverridden: 0,
              createdAt: nowIso(),
            };
            await insert("safety_checks", check);
            checks.push(check);
          }
        }
      }
    }

    // Check for duplication with existing medications
    for (const item of items) {
      const newMed = String(item.medicationName ?? "").toLowerCase();
      for (const existing of currentMeds) {
        const existingMed = String(existing.name ?? "").toLowerCase();
        if (newMed.includes(existingMed) || existingMed.includes(newMed)) {
          const check = {
            id: generateId("sc"),
            prescriptionId,
            patientId: String(rx.patientId),
            checkType: "duplication",
            medicationA: item.medicationName,
            medicationB: existing.name,
            severity: "moderate",
            message: `🔄 DUPLICATION: ${item.medicationName} appears to duplicate existing medication: ${existing.name} ${existing.dose}.`,
            recommendation: "Verify if this is intentional or a dose change. Consider stopping existing medication if adding new.",
            isOverridden: 0,
            createdAt: nowIso(),
          };
          await insert("safety_checks", check);
          checks.push(check);
        }
      }
    }

    const hasBlocked = checks.some((c) => c.severity === "blocked");
    const hasSevere = checks.some((c) => c.severity === "severe");
    const newStatus = hasBlocked ? "needs_review" : "safety_check";

    await update("prescriptions", prescriptionId, { status: newStatus, updatedAt: nowIso() });
    return json({
      prescriptionId,
      safetyChecks: checks,
      totalAlerts: checks.length,
      hasBlockedAlerts: hasBlocked,
      hasSevereAlerts: hasSevere,
      canProceed: !hasBlocked,
      message: hasBlocked
        ? "Prescription has blocked safety alerts. These must be resolved before signing."
        : checks.length > 0
          ? "Safety alerts found. Review before signing."
          : "No safety issues detected.",
      disclaimer: "Safety checks are assistive only. The prescribing clinician retains full clinical responsibility.",
    });
  }

  // ── Sign prescription ──
  if (action === "sign") {
    const prescriptionId = requiredString(body.prescriptionId, "prescriptionId");
    if (!prescriptionId) return error("prescriptionId is required");
    const rx = await queryOne<Record<string, unknown>>("SELECT * FROM prescriptions WHERE id = ?", [prescriptionId]);
    if (!rx) return error("Prescription not found", 404);
    if (rx.status === "signed") return error("Prescription is already signed");

    // Block if unresolved blocked alerts
    const blockedChecks = await query<Record<string, unknown>>(
      "SELECT * FROM safety_checks WHERE prescription_id = ? AND severity = 'blocked' AND is_overridden = 0",
      [prescriptionId]
    );
    if (blockedChecks.length > 0) {
      return error(`Cannot sign: ${blockedChecks.length} blocked safety alert(s) must be resolved first.`);
    }

    await update("prescriptions", prescriptionId, {
      status: "signed",
      signedAt: nowIso(),
      signedBy: "user-doc-001",
      updatedAt: nowIso(),
    });

    // Add to patient active medications
    const items = await query<Record<string, unknown>>("SELECT * FROM prescription_items WHERE prescription_id = ?", [prescriptionId]);
    for (const item of items) {
      await insert("medications", {
        id: generateId("med"),
        patientId: rx.patientId,
        name: item.medicationName,
        genericName: item.genericName,
        dose: item.dose,
        frequency: item.frequency,
        route: item.route,
        prescribedBy: "user-doc-001",
        status: "active",
        createdAt: nowIso(),
      });
    }

    const signed = await queryOne<Record<string, unknown>>("SELECT * FROM prescriptions WHERE id = ?", [prescriptionId]);
    return json({
      prescription: { ...signed, items },
      message: "Prescription signed successfully. Now ready for dispatch.",
    });
  }

  // ── Dispatch prescription ──
  if (action === "dispatch") {
    const prescriptionId = requiredString(body.prescriptionId, "prescriptionId");
    const channel = requiredString(body.channel, "channel") ?? "whatsapp";
    if (!prescriptionId) return error("prescriptionId is required");
    const rx = await queryOne<Record<string, unknown>>("SELECT * FROM prescriptions WHERE id = ?", [prescriptionId]);
    if (!rx) return error("Prescription not found", 404);
    if (rx.status !== "signed") return error("Only signed prescriptions can be dispatched");

    await update("prescriptions", prescriptionId, {
      status: "dispatched",
      dispatchedAt: nowIso(),
      dispatchChannel: channel,
      updatedAt: nowIso(),
    });

    // Log a message
    await insert("messages", {
      id: generateId("msg"),
      patientId: rx.patientId,
      channel,
      direction: "outbound",
      messageType: "prescription",
      content: "Your prescription has been issued by Dr. Ananya Arya. Please show this to your pharmacist.",
      status: "sent",
      approvedBy: "user-doc-001",
      approvedAt: nowIso(),
      sentAt: nowIso(),
      createdAt: nowIso(),
    });

    return json({ message: `Prescription dispatched via ${channel}.`, prescriptionId });
  }

  // ── Override a safety alert ──
  if (action === "override_alert") {
    const checkId = requiredString(body.checkId, "checkId");
    const reason = requiredString(body.reason, "reason");
    if (!checkId || !reason) return error("checkId and reason are required");
    await update("safety_checks", checkId, {
      isOverridden: 1,
      overriddenBy: "user-doc-001",
      overrideReason: reason,
      overriddenAt: nowIso(),
    });
    return json({ message: "Alert overridden. Ensure clinical reason is documented." });
  }

  return error("Unknown action. Use: create, safety_check, sign, dispatch, override_alert");
});
