// Generates supabase/seed.sql containing the exact demo dataset.
//
// Rather than regex-parsing the old imperative seed code (fragile), this rebuilds
// the original SQLite database by executing the pre-migration schema + seed from
// git history, then dumps the resulting rows as Postgres INSERT statements.
// The data is therefore reproduced exactly, not transcribed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const out = [];
const log = (s) => out.push(s);

// ── 1. fetch the pre-migration file from git ──
let old = null;
for (const rev of ["HEAD", "HEAD~1", "HEAD~2", "HEAD~3"]) {
  try {
    const text = execFileSync("git", ["show", `${rev}:app/api/_lib/database.ts`], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (text.includes("better-sqlite3") && text.includes("database.transaction")) {
      old = text;
      log(`source: git ${rev}:app/api/_lib/database.ts (${text.length} bytes)`);
      break;
    }
  } catch {
    /* try next rev */
  }
}
if (!old) {
  log("FAIL: pre-migration SQLite database.ts not found in git history");
  fs.writeFileSync("seed-gen-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}

// ── 2. extract the SQLite schema DDL ──
const schemaMatch = old.match(/database\.exec\(`([\s\S]*?)`\)/);
if (!schemaMatch) {
  log("FAIL: could not extract schema DDL");
  fs.writeFileSync("seed-gen-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}
const sqliteSchema = schemaMatch[1];

// ── 3. extract the seed transaction body ──
const seedStart = old.indexOf("const seed = database.transaction(");
if (seedStart < 0) {
  log("FAIL: could not locate seed transaction");
  fs.writeFileSync("seed-gen-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}
const bodyOpen = old.indexOf("{", old.indexOf("=>", seedStart));
let depth = 0;
let bodyEnd = -1;
for (let i = bodyOpen; i < old.length; i++) {
  if (old[i] === "{") depth++;
  else if (old[i] === "}") {
    depth--;
    if (depth === 0) { bodyEnd = i; break; }
  }
}
if (bodyEnd < 0) {
  log("FAIL: could not delimit seed body");
  fs.writeFileSync("seed-gen-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}
let seedBody = old.slice(bodyOpen + 1, bodyEnd);
log(`seed body extracted: ${seedBody.length} bytes`);

// The body is TypeScript ("... .get() as { count: number }"), which new Function()
// cannot parse. Strip type assertions. Patterns are deliberately narrow — requiring
// "{" or an uppercase/primitive type name — so an " as " inside a seed string literal
// is never touched.
const beforeStrip = seedBody.length;
seedBody = seedBody
  .replace(/\s+as\s+\{[^{}]*\}/g, "")
  .replace(/\s+as\s+(?:unknown|string|number|boolean)\b/g, "")
  .replace(/\s+as\s+[A-Z]\w*(?:<[^<>]*>)?(?:\[\])?/g, "");
log(`type assertions stripped: ${beforeStrip - seedBody.length} bytes removed`);

// ── 4. rebuild the SQLite database in a temp file ──
const tmp = path.join(os.tmpdir(), `aiupchar-seedgen-${process.pid}.sqlite`);
fs.rmSync(tmp, { force: true });
const database = new Database(tmp);
database.pragma("foreign_keys = OFF");
database.exec(sqliteSchema);

const datetime = () => new Date().toISOString();
// The seed body only references `database` and `datetime`, both provided here.
const runSeed = new Function("database", "datetime", seedBody);
runSeed(database, datetime);
log("seed executed against temporary SQLite database");

// ── 5. dump rows as Postgres INSERTs ──
const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

// Insert parents before children so future FK constraints stay satisfiable.
const ORDER = [
  "clinics", "users", "patients", "profile_settings",
  "appointments", "appointment_slots", "queue_entries", "queue_tokens",
  "visits", "vitals", "reports", "scribe_notes", "insights",
  "medications", "allergies", "conditions",
  "intake_sessions", "intake_responses",
  "pre_visit_briefs", "attention_signals",
  "prescriptions", "prescription_items", "safety_checks", "drug_interactions_db",
  "follow_ups", "diagnostic_orders", "referrals",
  "inbox_items", "messages", "communication_preferences",
  "ai_sessions", "ai_outputs", "workflow_metrics",
  "patient_identities", "consents", "proxy_relationships", "audit_logs",
];
const ordered = [...ORDER.filter((t) => tables.includes(t)), ...tables.filter((t) => !ORDER.includes(t))];

const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (Buffer.isBuffer(v)) return "'" + v.toString("utf8").replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const statements = [];
const perTable = {};
for (const table of ordered) {
  const rows = database.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  for (const row of rows) {
    statements.push(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => q(row[c])).join(", ")}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  perTable[table] = rows.length;
}

database.close();
fs.rmSync(tmp, { force: true });

const header = `-- AI UPCHAR — demo seed data (Postgres / Supabase)
-- GENERATED by scripts/gen-seed.mjs. It rebuilds the original SQLite demo database
-- from git history and dumps the real rows, so the dataset matches exactly.
-- Idempotent: every statement uses ON CONFLICT (id) DO NOTHING.

`;
fs.mkdirSync("supabase", { recursive: true });
fs.writeFileSync("supabase/seed.sql", header + statements.join("\n") + "\n", "utf8");

log("");
log(`total INSERT statements: ${statements.length}`);
log("rows per table:");
for (const [t, n] of Object.entries(perTable)) log(`  ${t}: ${n}`);
const empty = ordered.filter((t) => !perTable[t]);
log("");
log(`tables with no seed rows (${empty.length}): ${empty.join(", ")}`);

fs.writeFileSync("seed-gen-report.txt", out.join("\n"), "utf8");
