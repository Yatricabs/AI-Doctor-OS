/**
 * Imports the patient-domain demo data exposed by the ZIP preview into the
 * PostgreSQL database used by this checkout. It imports the ZIP preview's
 * persisted operational seed domain: patients, reports, appointments,
 * pre-visit briefs, inventory/service catalogue, billing and inbox alerts.
 *
 * Usage:
 *   node scripts/migrate-zip-preview-patient-data.mjs          # inspect only
 *   node scripts/migrate-zip-preview-patient-data.mjs --apply  # perform upserts
 *
 * The script never deletes data. Re-running it is safe: source IDs are
 * upserted, so the known ZIP seed records converge to the same values.
 */
import fs from "node:fs";
import { Pool } from "pg";

const apply = process.argv.includes("--apply");
const sourceBaseUrl = (process.env.ZIP_PREVIEW_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

// These rows are part of the ZIP preview's in-memory database but do not have
// read endpoints. Keep them here so a complete migration does not depend on
// parsing TypeScript source files at runtime.
const zipStaticSeed = {
  insights: [
    { id: "insight-1", title: "Follow-up queue", detail: "Three follow-ups need review before the next clinic block.", priority: "High", status: "open" },
    { id: "insight-2", title: "Report trend", detail: "Rohan Mehta's HbA1c improved while LDL remains above target.", priority: "Medium", status: "open" },
    { id: "insight-3", title: "Documentation quality", detail: "Two draft notes need clinician approval before signing.", priority: "Low", status: "open" },
  ],
  profile: {
    fullName: "Dr. Ananya Arya",
    specialty: "General Medicine",
    clinicBio: "Clinician focused on practical, preventive adult care.",
    notifications: { urgentFollowUps: true, weeklySummary: true, twoStepSignIn: true },
  },
};

function databaseUrl() {
  const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is missing from .env.local.");
  return line.slice("DATABASE_URL=".length);
}

async function sourceList(path, key) {
  const response = await fetch(`${sourceBaseUrl}${path}`);
  if (!response.ok) throw new Error(`ZIP preview ${path} returned HTTP ${response.status}.`);
  const payload = await response.json();
  const result = payload?.data?.[key];
  if (!Array.isArray(result)) throw new Error(`ZIP preview ${path} did not return data.${key}.`);
  return result;
}

function dobFromAge(age) {
  const years = Number(age);
  return Number.isFinite(years) && years > 0 && years < 130 ? `${new Date().getUTCFullYear() - years}-01-01` : null;
}

function sexValue(value) {
  if (value === "Male") return "Man";
  if (value === "Female") return "Woman";
  return value || null;
}

function appointmentChannel(value) {
  return ({ "WhatsApp": "whatsapp", "Voice call": "voice", "Mobile app": "mobile", "Walk-in": "front_desk" })[value] ?? "web";
}

function appointmentStatus(value) {
  return ({ Scheduled: "confirmed", Completed: "completed", Cancelled: "cancelled", "No-show": "no_show" })[value] ?? "requested";
}

function inventoryCategory(value) {
  return ({ Test: "test", Scan: "scan", Procedure: "procedure" })[value] ?? "medicine";
}

function billItemType(value) {
  return ({ "Consultation fee": "appointment", Medicine: "medicine", Test: "test", Scan: "scan", Procedure: "scan" })[value] ?? "appointment";
}

function inboxCategory(value) {
  return ({ report_pending: "report", duplicate_identity: "identity", conflict: "clinical_context", red_flag: "safety", reschedule: "appointment" })[value] ?? "task";
}

function inboxPriority(value) {
  return ({ red_flag: "urgent", duplicate_identity: "high", conflict: "high", reschedule: "medium", report_pending: "medium" })[value] ?? "medium";
}

async function existingIds(client, table, ids) {
  const { rows } = await client.query(`SELECT id FROM ${table} WHERE id = ANY($1::text[])`, [ids]);
  return new Set(rows.map((row) => row.id));
}

async function main() {
  const [patients, reports, appointments, medicinePayload, servicePayload, billingPayload, inboxPayload] = await Promise.all([
    sourceList("/api/patients", "patients"),
    sourceList("/api/medical-records/reports", "reports"),
    sourceList("/api/appointments", "appointments"),
    sourceList("/api/inventory/medicines", "medicines"),
    sourceList("/api/inventory/services", "services"),
    sourceList("/api/billing", "transactions"),
    sourceList("/api/inbox", "items"),
  ]);
  const medicines = medicinePayload;
  const services = servicePayload;
  const billingTransactions = billingPayload;
  const inboxItems = inboxPayload;
  const sourcePatientIds = new Set(patients.map((patient) => patient.id));
  if (appointments.some((appointment) => !sourcePatientIds.has(appointment.patientId)) || reports.some((report) => !sourcePatientIds.has(report.patientId))) {
    throw new Error("ZIP preview data contains an appointment or report without a source patient.");
  }

  const pool = new Pool({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // A transaction client executes one query at a time. Keep these checks
    // sequential so pg never interleaves work on the same connection.
    const knownPatients = await existingIds(client, "patients", patients.map((patient) => patient.id));
    const knownReports = await existingIds(client, "reports", reports.map((report) => report.id));
    const knownAppointments = await existingIds(client, "appointments", appointments.map((appointment) => appointment.id));
    const inventoryIds = [...medicines, ...services].map((item) => item.id);
    const knownInventory = await existingIds(client, "inventory_items", inventoryIds);
    const billIds = billingTransactions.map((transaction) => `zip-bill-${transaction.id}`);
    const knownBills = await existingIds(client, "bills", billIds);
    const knownInbox = await existingIds(client, "inbox_items", inboxItems.map((item) => item.id));
    const knownInsights = await existingIds(client, "insights", zipStaticSeed.insights.map((insight) => insight.id));
    const summary = {
      source: sourceBaseUrl,
      mode: apply ? "apply" : "dry-run",
      patients: { insert: patients.length - knownPatients.size, update: knownPatients.size },
      reports: { insert: reports.length - knownReports.size, update: knownReports.size },
      appointments: { insert: appointments.length - knownAppointments.size, update: knownAppointments.size },
      preVisitBriefs: appointments.filter((appointment) => appointment.briefReady).length,
      inventory: { insert: inventoryIds.length - knownInventory.size, update: knownInventory.size, medicines: medicines.length, services: services.length },
      billing: { insert: billIds.length - knownBills.size, update: knownBills.size, billItems: billingTransactions.length },
      inbox: { insert: inboxItems.length - knownInbox.size, update: knownInbox.size },
      insights: { insert: zipStaticSeed.insights.length - knownInsights.size, update: knownInsights.size },
      profileSettings: "upsert",
    };
    if (!apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    await client.query("BEGIN");
    for (const patient of patients) {
      await client.query(
        `INSERT INTO patients (id, name, initials, appointment, status, date_of_birth, gender, phone, address, patient_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, initials = EXCLUDED.initials, appointment = EXCLUDED.appointment,
           status = EXCLUDED.status, date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender,
           phone = EXCLUDED.phone, address = EXCLUDED.address, updated_at = EXCLUDED.updated_at`,
        [patient.id, patient.name, patient.initials, patient.appointment, patient.status, dobFromAge(patient.age), sexValue(patient.sex), patient.phone, patient.location],
      );
    }
    for (const report of reports) {
      await client.query(
        `INSERT INTO reports (id, patient_id, title, type, date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET patient_id = EXCLUDED.patient_id, title = EXCLUDED.title, type = EXCLUDED.type, date = EXCLUDED.date, status = EXCLUDED.status`,
        [report.id, report.patientId, report.title, report.type, report.date, report.status],
      );
    }
    for (const appointment of appointments) {
      const notes = JSON.stringify({ source: "zip-preview", priority: appointment.priority, queuePosition: appointment.queuePosition, consultationFee: appointment.consultationFee, missingInfo: appointment.missingInfo ?? null });
      await client.query(
        `INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, visit_type, appointment_date, appointment_time, duration_minutes, status, reason, channel, notes, created_at, updated_at)
         VALUES ($1, $2, 'user-doc-001', 'clinic-001', $3, $4, $5, 15, $6, $7, $8, $9, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
         ON CONFLICT (id) DO UPDATE SET patient_id = EXCLUDED.patient_id, doctor_id = EXCLUDED.doctor_id,
           clinic_id = EXCLUDED.clinic_id, visit_type = EXCLUDED.visit_type, appointment_date = EXCLUDED.appointment_date,
           appointment_time = EXCLUDED.appointment_time, duration_minutes = EXCLUDED.duration_minutes,
           status = EXCLUDED.status, reason = EXCLUDED.reason, channel = EXCLUDED.channel, notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [appointment.id, appointment.patientId, appointment.visitType === "Follow-up" ? "follow_up" : "new_complaint", appointment.date, appointment.time, appointmentStatus(appointment.status), appointment.reason, appointmentChannel(appointment.channel), notes],
      );
      if (appointment.briefReady) {
        await client.query(
          `INSERT INTO pre_visit_briefs (id, visit_id, patient_id, visit_reason, patient_type, history_summary, what_changed, missing_info, attention_signals, patient_questions, ai_considerations, queue_status, ai_label, confidence, source_ids, review_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]', '[]', '[]', 'Appointment imported', 'AI_GENERATED', 'moderate', '["zip-preview"]', 'generated', NOW() AT TIME ZONE 'UTC')
           ON CONFLICT (id) DO UPDATE SET visit_id = EXCLUDED.visit_id, patient_id = EXCLUDED.patient_id,
             visit_reason = EXCLUDED.visit_reason, patient_type = EXCLUDED.patient_type, history_summary = EXCLUDED.history_summary,
             what_changed = EXCLUDED.what_changed, missing_info = EXCLUDED.missing_info, queue_status = EXCLUDED.queue_status,
             source_ids = EXCLUDED.source_ids`,
          [`zip-brief-${appointment.id}`, appointment.id, appointment.patientId, appointment.reason, appointment.visitType === "Follow-up" ? "returning" : "new", appointment.briefSummary, appointment.briefSummary, JSON.stringify(appointment.missingInfo ? [appointment.missingInfo] : [])],
        );
      }
    }
    for (const medicine of medicines) {
      await client.query(
        `INSERT INTO inventory_items (id, name, category, unit, price, purchase_price, stock_qty, low_stock_threshold, tracks_stock, is_active, created_at, updated_at)
         VALUES ($1, $2, 'medicine', $3, $4, $5, $6, $7, 1, 1, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, unit = EXCLUDED.unit,
           price = EXCLUDED.price, purchase_price = EXCLUDED.purchase_price, stock_qty = EXCLUDED.stock_qty,
           low_stock_threshold = EXCLUDED.low_stock_threshold, tracks_stock = EXCLUDED.tracks_stock,
           is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at`,
        [medicine.id, medicine.name, medicine.unit, medicine.salePrice, medicine.purchasePrice, medicine.currentStock, medicine.minStock],
      );
    }
    for (const service of services) {
      const category = inventoryCategory(service.category);
      await client.query(
        `INSERT INTO inventory_items (id, name, category, unit, price, purchase_price, stock_qty, low_stock_threshold, tracks_stock, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, unit = EXCLUDED.unit,
           price = EXCLUDED.price, purchase_price = EXCLUDED.purchase_price, stock_qty = EXCLUDED.stock_qty,
           low_stock_threshold = EXCLUDED.low_stock_threshold, tracks_stock = EXCLUDED.tracks_stock,
           is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at`,
        [service.id, service.name, category, category, service.price, service.status === "Active" ? 1 : 0],
      );
    }
    for (const transaction of billingTransactions) {
      const billId = `zip-bill-${transaction.id}`;
      const itemId = `${billId}-item-1`;
      const itemType = billItemType(transaction.type);
      await client.query(
        `INSERT INTO bills (id, patient_id, appointment_id, doctor_id, clinic_id, status, subtotal, total, currency, notes, created_at, updated_at)
         VALUES ($1, $2, $3, 'user-doc-001', 'clinic-001', 'paid', $4, $4, 'INR', $5, $6, $6)
         ON CONFLICT (id) DO UPDATE SET patient_id = EXCLUDED.patient_id, appointment_id = EXCLUDED.appointment_id,
           subtotal = EXCLUDED.subtotal, total = EXCLUDED.total, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at`,
        [billId, transaction.patientId, transaction.appointmentId ?? null, transaction.amount, JSON.stringify({ source: "zip-preview", sourceTransactionId: transaction.id, date: transaction.date }), transaction.createdAt],
      );
      await client.query(
        `INSERT INTO bill_items (id, bill_id, inventory_item_id, item_type, description, quantity, unit_price, amount, created_at)
         VALUES ($1, $2, NULL, $3, $4, 1, $5, $5, $6)
         ON CONFLICT (id) DO UPDATE SET bill_id = EXCLUDED.bill_id, inventory_item_id = EXCLUDED.inventory_item_id,
           item_type = EXCLUDED.item_type, description = EXCLUDED.description, quantity = EXCLUDED.quantity,
           unit_price = EXCLUDED.unit_price, amount = EXCLUDED.amount`,
        [itemId, billId, itemType, transaction.description, transaction.amount, transaction.createdAt],
      );
    }
    for (const item of inboxItems) {
      await client.query(
        `INSERT INTO inbox_items (id, patient_id, category, title, detail, priority, status, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'zip-preview', $8)
         ON CONFLICT (id) DO UPDATE SET patient_id = EXCLUDED.patient_id, category = EXCLUDED.category,
           title = EXCLUDED.title, detail = EXCLUDED.detail, priority = EXCLUDED.priority, status = EXCLUDED.status,
           source = EXCLUDED.source`,
        [item.id, item.patientId ?? null, inboxCategory(item.type), item.title, item.detail, inboxPriority(item.type), item.status, item.createdAt],
      );
    }
    for (const insight of zipStaticSeed.insights) {
      await client.query(
        `INSERT INTO insights (id, title, detail, priority, status, category)
         VALUES ($1, $2, $3, $4, $5, 'zip-preview')
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, detail = EXCLUDED.detail,
           priority = EXCLUDED.priority, status = EXCLUDED.status, category = EXCLUDED.category`,
        [insight.id, insight.title, insight.detail, insight.priority, insight.status],
      );
    }
    await client.query(
      `INSERT INTO profile_settings (id, full_name, specialty, clinic_bio, urgent_follow_ups, weekly_summary, two_step_sign_in)
       VALUES (1, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, specialty = EXCLUDED.specialty,
         clinic_bio = EXCLUDED.clinic_bio, urgent_follow_ups = EXCLUDED.urgent_follow_ups,
         weekly_summary = EXCLUDED.weekly_summary, two_step_sign_in = EXCLUDED.two_step_sign_in`,
      [
        zipStaticSeed.profile.fullName,
        zipStaticSeed.profile.specialty,
        zipStaticSeed.profile.clinicBio,
        zipStaticSeed.profile.notifications.urgentFollowUps ? 1 : 0,
        zipStaticSeed.profile.notifications.weeklySummary ? 1 : 0,
        zipStaticSeed.profile.notifications.twoStepSignIn ? 1 : 0,
      ],
    );
    await client.query("COMMIT");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
