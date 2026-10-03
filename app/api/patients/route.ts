import {
  error,
  json,
  listPatients,
  addPatient,
  patientById,
  optionalString,
  type Patient,
  query,
  readObject,
  requiredString,
  safeRoute,
} from "../_lib/demo";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Normalise a phone number for comparison: keep only the last 10 digits so that
// "+91-9876543210", "9876543210", and "09876543210" all match.
function phoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

export const GET = safeRoute(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const phone = params.get("phone")?.trim();

  // ── Lookup an existing patient by mobile number (for follow-up booking) ──
  if (phone) {
    const key = phoneKey(phone);
    if (key.length < 10) return error("Enter a valid 10-digit mobile number.");
    const all = await listPatients();
    const match = all.find((p) => p.phone && phoneKey(p.phone) === key);
    if (!match) return json({ found: false, patient: null });

    // Enrich with recent context so the booking screen can greet the patient.
    const [appointments, followUps] = await Promise.all([
      query<Record<string, unknown>>(
        "SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC, appointment_time DESC LIMIT 3",
        [match.id]
      ),
      query<Record<string, unknown>>(
        "SELECT * FROM follow_ups WHERE patient_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 3",
        [match.id]
      ),
    ]);
    return json({ found: true, patient: match, recentAppointments: appointments, pendingFollowUps: followUps });
  }

  // ── Search / list (name or id substring) ──
  const q = params.get("q")?.trim().toLowerCase() ?? "";
  const status = params.get("status");
  const all = await listPatients();
  const data = all.filter((patient) => {
    const matchesQuery = !q || `${patient.name} ${patient.id}`.toLowerCase().includes(q);
    const matchesStatus = !status || patient.status === status;
    return matchesQuery && matchesStatus;
  });

  const session = await getServerSession(authOptions);
  if (session?.user) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await logAuditAction({
      userId: (session.user as any).id,
      action: "VIEW_PATIENT",
      entityType: "PATIENT",
      details: { query: q, statusFilter: status, matchCount: data.length },
      ipAddress: ip
    }).catch(console.error);
  }

  return json({ patients: data, total: data.length });
});

// Derive an approximate date-of-birth from an age in years (Jan 1 of the birth year).
function dobFromAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");

  const name = requiredString(body.name, "name", 100);
  if (!name) return error("name is required and must be a non-empty string.");

  const phone = optionalString(body.phone, 20);
  // A registered patient should have a mobile number; block duplicates on it.
  if (phone) {
    const key = phoneKey(phone);
    if (key.length && key.length < 10) return error("Enter a valid 10-digit mobile number.");
    const all = await listPatients();
    const clash = all.find((p) => p.phone && phoneKey(p.phone) === key);
    if (clash) return error("A patient with this mobile number already exists.", 409);
  }

  const gender = optionalString(body.gender, 20);
  const address = optionalString(body.address, 200);
  const appointment = optionalString(body.appointment, 160) ?? "No appointment scheduled";

  // Accept either an explicit dateOfBirth or an age in years.
  let dateOfBirth = optionalString(body.dateOfBirth, 20);
  if (!dateOfBirth && typeof body.age === "number" && body.age > 0 && body.age < 130) {
    dateOfBirth = dobFromAge(body.age);
  } else if (!dateOfBirth && typeof body.age === "string" && /^\d{1,3}$/.test(body.age.trim())) {
    dateOfBirth = dobFromAge(Number(body.age.trim()));
  }

  const all = await listPatients();
  const id = requiredString(body.id, "id", 30) ?? `P-${Date.now().toString().slice(-6)}`;
  if (await patientById(id)) return error("A patient with this id already exists.", 409);

  const patient: Patient = {
    id,
    name,
    initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    appointment,
    status: "Waiting",
    phone,
    gender,
    address,
    dateOfBirth,
    patientType: "new",
  };
  await addPatient(patient);
  return json({ patient }, 201);
});
