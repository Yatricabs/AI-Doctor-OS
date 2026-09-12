// Applies supabase/seed.sql and reports resulting row counts.
// Runs over whatever DATABASE_URL points at (now the IPv4 pooler), so this also
// verifies the pooler works for real application-style queries.
import fs from "node:fs";
import pg from "pg";
import { loadEnv, pgConfigFromUrl, describe } from "./db-config.mjs";

const out = [];
const log = (s) => out.push(s);

const env = loadEnv();
const cfg = pgConfigFromUrl(env.DATABASE_URL);
log("connecting: " + describe(cfg));

const seed = fs.readFileSync("supabase/seed.sql", "utf8");

const client = new pg.Client(cfg);
try {
  await client.connect();
  log("connected OK");

  await client.query(seed);
  log("seed applied OK");

  const tables = [
    "clinics", "users", "patients", "profile_settings", "appointments",
    "queue_entries", "reports", "insights", "medications", "allergies",
    "conditions", "pre_visit_briefs", "drug_interactions_db", "follow_ups",
    "diagnostic_orders", "referrals", "inbox_items", "messages", "workflow_metrics",
  ];
  log("");
  log("row counts in Supabase:");
  let total = 0;
  for (const t of tables) {
    const r = await client.query(`select count(*)::int as n from ${t}`);
    total += r.rows[0].n;
    log(`  ${t}: ${r.rows[0].n}`);
  }
  log(`  TOTAL: ${total}`);

  // Spot-check a representative row to confirm data fidelity.
  const p = await client.query("select id, name, status, patient_type from patients order by id");
  log("");
  log("patients:");
  for (const r of p.rows) log(`  ${r.id} | ${r.name} | ${r.status} | ${r.patient_type}`);

  await client.end();
  log("");
  log("RESULT: SEED OK");
} catch (e) {
  log(`FAIL: ${e.code ?? ""} ${e.message}`);
  if (e.position) log(`  at character position ${e.position}`);
  try { await client.end(); } catch {}
  log("");
  log("RESULT: SEED FAILED");
}

fs.writeFileSync("apply-seed-report.txt", out.join("\n"), "utf8");
