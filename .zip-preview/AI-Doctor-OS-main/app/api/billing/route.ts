import { BillingTransaction, applyStockTransaction, billingTransactions, error, json, medicines, Medicine, optionalString, patientById, readObject, requiredNumber, requiredString, Service, services } from "../_lib/demo";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  const date = url.searchParams.get("date");
  const data = [...(billingTransactions as unknown as BillingTransaction[])]
    .filter((tx) => (!patientId || tx.patientId === patientId) && (!date || tx.date === date))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = data.reduce((sum, tx) => sum + tx.amount, 0);
  return json({ transactions: data, total, count: data.length });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const patientId = requiredString(body.patientId, "patientId", 30);
  if (!patientId) return error("patientId is required.");
  const patient = patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  const type = requiredString(body.type, "type", 30) as BillingTransaction["type"] | null;
  if (!type || !["Consultation fee", "Medicine", "Test", "Scan", "Procedure"].includes(type)) {
    return error("type must be one of Consultation fee, Medicine, Test, Scan, Procedure.");
  }
  const appointmentId = optionalString(body.appointmentId, 60);
  const date = optionalString(body.date, 20) ?? new Date().toISOString().slice(0, 10);

  let description = optionalString(body.description, 200);
  let amount = requiredNumber(body.amount, 0);

  if (type === "Medicine") {
    const medicineId = requiredString(body.medicineId, "medicineId", 60);
    const quantity = requiredNumber(body.quantity, 1);
    if (!medicineId || quantity === null) return error("medicineId and quantity (1 or more) are required for a Medicine transaction.");
    const medicine = (medicines as unknown as Medicine[]).find((item) => item.id === medicineId);
    if (!medicine) return error("Medicine not found.", 404);
    const updated = applyStockTransaction(medicineId, "out", quantity, `Dispensed to ${patient.name}${appointmentId ? ` (appt ${appointmentId})` : ""}`);
    if (!updated) return error(`Not enough stock of ${medicine.name} to dispense ${quantity} ${medicine.unit}(s).`, 409);
    description = description ?? `${medicine.name} × ${quantity} ${medicine.unit}(s)`;
    amount = amount ?? medicine.salePrice * quantity;
  } else if (type === "Test" || type === "Scan" || type === "Procedure") {
    const serviceId = optionalString(body.serviceId, 60);
    if (serviceId) {
      const service = (services as unknown as Service[]).find((item) => item.id === serviceId);
      if (!service) return error("Service not found.", 404);
      description = description ?? service.name;
      amount = amount ?? service.price;
    }
  }

  if (!description) return error("description is required (or provide medicineId/serviceId to derive it).");
  if (amount === null) return error("amount is required (or provide medicineId/serviceId to derive it).");

  const transaction: BillingTransaction = { id: `bill-${Date.now()}`, patientId, patientName: patient.name, appointmentId, type, description, amount, date, createdAt: new Date().toISOString() };
  billingTransactions.push(transaction);
  return json({ transaction }, 201);
}
