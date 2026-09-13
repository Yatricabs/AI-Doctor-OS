// Seed catalogue for the demo — EXACT values from the AI UPCHAR Demo Product
// Workflow Specification §20 (medicines) and §21 (tests & scans). Prices are
// demo defaults in INR and are editable in the UI.
//
// Medicines track stock (physical units). Tests/scans are services and do NOT
// track stock (spec §19: "Do not model MRI/test services as physical
// tablet-like stock.").

import { generateId, insert, nowIso, query, type InventoryCategory } from "./demo";

export type SeedItem = {
  name: string;
  category: InventoryCategory;
  unit: string;
  price: number;        // demo sale price (INR)
  purchasePrice: number; // demo purchase price (INR) — below sale for a margin
  stockQty: number;
  lowStockThreshold: number;
};

// §20 Seed Medicine Catalogue (unit + demo sale price). Purchase price is a
// plausible demo cost below the sale price; stock is a demo starting quantity.
const MEDICINES: Omit<SeedItem, "category">[] = [
  { name: "Paracetamol 500 mg", unit: "Tablet", price: 2, purchasePrice: 1, stockQty: 500, lowStockThreshold: 50 },
  { name: "Azithromycin 500 mg", unit: "Tablet", price: 12, purchasePrice: 8, stockQty: 200, lowStockThreshold: 30 },
  { name: "Amoxicillin 500 mg", unit: "Capsule", price: 8, purchasePrice: 5, stockQty: 300, lowStockThreshold: 40 },
  { name: "Pantoprazole 40 mg", unit: "Tablet", price: 5, purchasePrice: 3, stockQty: 250, lowStockThreshold: 30 },
  { name: "Cetirizine 10 mg", unit: "Tablet", price: 3, purchasePrice: 1.5, stockQty: 400, lowStockThreshold: 40 },
  { name: "Metformin 500 mg", unit: "Tablet", price: 4, purchasePrice: 2, stockQty: 350, lowStockThreshold: 40 },
  { name: "Amlodipine 5 mg", unit: "Tablet", price: 3, purchasePrice: 1.5, stockQty: 300, lowStockThreshold: 30 },
  { name: "Atorvastatin 10 mg", unit: "Tablet", price: 6, purchasePrice: 3.5, stockQty: 250, lowStockThreshold: 30 },
  { name: "Omeprazole 20 mg", unit: "Capsule", price: 4, purchasePrice: 2, stockQty: 300, lowStockThreshold: 30 },
  { name: "Ibuprofen 400 mg", unit: "Tablet", price: 5, purchasePrice: 2.5, stockQty: 300, lowStockThreshold: 30 },
  { name: "ORS", unit: "Sachet", price: 20, purchasePrice: 12, stockQty: 150, lowStockThreshold: 20 },
  { name: "Ondansetron 4 mg", unit: "Tablet", price: 7, purchasePrice: 4, stockQty: 150, lowStockThreshold: 20 },
  { name: "Diclofenac Gel", unit: "Tube", price: 95, purchasePrice: 65, stockQty: 60, lowStockThreshold: 10 },
  { name: "Cough Syrup", unit: "Bottle", price: 110, purchasePrice: 75, stockQty: 50, lowStockThreshold: 10 },
  { name: "Multivitamin", unit: "Tablet", price: 6, purchasePrice: 3, stockQty: 300, lowStockThreshold: 30 },
];

// §21 Seed Test & Scan Catalogue (category + demo price). The spec uses
// Test / Scan / Procedure; we map "Procedure" to the "test" service bucket
// (services don't track stock either way).
type ServiceSeed = { name: string; category: InventoryCategory; price: number; unit: string };
const SERVICES: ServiceSeed[] = [
  { name: "CBC", category: "test", price: 350, unit: "test" },
  { name: "Blood Glucose", category: "test", price: 100, unit: "test" },
  { name: "HbA1c", category: "test", price: 450, unit: "test" },
  { name: "Lipid Profile", category: "test", price: 650, unit: "test" },
  { name: "Liver Function Test", category: "test", price: 700, unit: "test" },
  { name: "Kidney Function Test", category: "test", price: 650, unit: "test" },
  { name: "Thyroid Profile", category: "test", price: 550, unit: "test" },
  { name: "Urine Routine", category: "test", price: 180, unit: "test" },
  { name: "Vitamin D", category: "test", price: 1200, unit: "test" },
  { name: "Vitamin B12", category: "test", price: 800, unit: "test" },
  { name: "X-Ray Chest", category: "scan", price: 500, unit: "scan" },
  { name: "X-Ray Knee", category: "scan", price: 500, unit: "scan" },
  { name: "Ultrasound Abdomen", category: "scan", price: 1000, unit: "scan" },
  { name: "Ultrasound Pelvis", category: "scan", price: 1000, unit: "scan" },
  { name: "CT Brain", category: "scan", price: 3500, unit: "scan" },
  { name: "CT Abdomen", category: "scan", price: 5000, unit: "scan" },
  { name: "MRI Brain", category: "scan", price: 6000, unit: "scan" },
  { name: "MRI Spine", category: "scan", price: 7000, unit: "scan" },
  { name: "ECG", category: "test", price: 300, unit: "procedure" }, // §21 "Procedure"
  { name: "2D Echo", category: "scan", price: 2500, unit: "scan" },
];

/**
 * Seed the inventory catalogue. Idempotent: only inserts items whose name does
 * not already exist (so re-running never duplicates or overwrites edited prices).
 * Returns how many were added.
 */
// Normalize a catalogue name for de-dup: lowercase, drop all non-alphanumerics.
// So "Paracetamol 500 mg" and "Paracetamol 500mg" collide and won't double-seed.
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function seedCatalogue(): Promise<{ added: number; skipped: number }> {
  const existing = await query<{ name: string }>("SELECT name FROM inventory_items", []);
  const have = new Set(existing.map((r) => normName(r.name)));
  const now = nowIso();
  let added = 0;
  let skipped = 0;

  for (const m of MEDICINES) {
    if (have.has(normName(m.name))) { skipped++; continue; }
    await insert("inventory_items", {
      id: generateId("inv"), name: m.name, category: "medicine", unit: m.unit,
      price: m.price, purchasePrice: m.purchasePrice, stockQty: m.stockQty,
      lowStockThreshold: m.lowStockThreshold, tracksStock: 1, isActive: 1,
      createdAt: now, updatedAt: now,
    });
    added++;
  }

  for (const s of SERVICES) {
    if (have.has(normName(s.name))) { skipped++; continue; }
    await insert("inventory_items", {
      id: generateId("inv"), name: s.name, category: s.category, unit: s.unit,
      price: s.price, purchasePrice: 0, stockQty: 0, lowStockThreshold: 0,
      tracksStock: 0, isActive: 1, createdAt: now, updatedAt: now,
    });
    added++;
  }

  return { added, skipped };
}
