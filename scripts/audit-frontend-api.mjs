import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
// These screens are required to use the shared RTK Query API boundary.
const migrated = [
  "components/workspace/DashboardScreen.tsx",
  "components/workspace/AppointmentsScreen.tsx",
  "components/workspace/PatientsScreen.tsx",
  "components/workspace/InventoryScreen.tsx",
  "components/workspace/BillingScreen.tsx",
  "components/workspace/PrescriptionLetter.tsx",
  "components/workspace/PrescriptionBuilder.tsx",
  "components/PortalVisitHistory.tsx",
  "components/workspace/PreVisitBrief.tsx",
  "app/patient/intake/page.tsx",
  "app/admin/analytics/page.tsx",
  "app/doctor/follow-ups/page.tsx",
  "app/doctor/inbox/page.tsx",
  "app/doctor/morning-brief/page.tsx",
  "app/doctor/queue/page.tsx",
  "app/patient/book/page.tsx",
  "app/reception/checkin/page.tsx",
];

// Ordered patient workflows retain local orchestration, but their endpoint
// contracts are represented in workspaceApi for safe incremental adoption.
const intentionalExceptions = {
  "app/patient/appointment/page.tsx": "ordered identity/intake/report/appointment orchestration",
  "lib/aiTraining.ts": "best-effort AI feedback helper",
};

const violations = [];
for (const relative of migrated) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (/\b(apiGet|apiSend|fetch|axios)\s*\(/.test(source)) violations.push(relative);
}
if (violations.length) {
  console.error(`Direct API wrappers remain in migrated screens:\n${violations.join("\n")}`);
  process.exit(1);
}

for (const [relative, reason] of Object.entries(intentionalExceptions)) {
  if (!fs.existsSync(path.join(root, relative))) {
    console.error(`Intentional exception is missing: ${relative}`);
    process.exit(1);
  }
  console.log(`Intentional exception: ${relative} — ${reason}`);
}
console.log(`RTK Query frontend audit passed for ${migrated.length} migrated screens.`);
