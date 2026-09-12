// Verifies we can actually reach the Supabase Postgres instance before migrating.
// Tries the configured DATABASE_URL, and if that host does not resolve (Supabase
// direct connections are IPv6-only on newer projects), reports that clearly.
import fs from "node:fs";
import dns from "node:dns/promises";
import pg from "pg";
import { loadEnv, pgConfigFromUrl, describe } from "./db-config.mjs";

const out = [];
const log = (s) => out.push(s);

const env = loadEnv();
const url = env.DATABASE_URL;

if (!url) {
  log("FAIL: DATABASE_URL not present in .env.local");
  fs.writeFileSync("conn-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}

let cfg;
try {
  cfg = pgConfigFromUrl(url);
  log("parsed config: " + describe(cfg));
} catch (e) {
  log("FAIL parsing DATABASE_URL: " + e.message);
  fs.writeFileSync("conn-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}

// DNS first — distinguishes "wrong host" from "auth failure".
for (const family of [4, 6]) {
  try {
    const recs = await dns.resolve(cfg.host, family === 4 ? "A" : "AAAA");
    log(`DNS IPv${family}: ${recs.join(", ")}`);
  } catch (e) {
    log(`DNS IPv${family}: none (${e.code})`);
  }
}

async function tryConnect(label, config) {
  const client = new pg.Client(config);
  const started = Date.now();
  try {
    await client.connect();
    const v = await client.query("select current_database() as db, current_user as usr, version() as ver");
    log(`${label}: OK in ${Date.now() - started}ms`);
    log(`  db=${v.rows[0].db} user=${v.rows[0].usr}`);
    log(`  ${String(v.rows[0].ver).split(" ").slice(0, 2).join(" ")}`);
    const t = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema='public'"
    );
    log(`  existing public tables: ${t.rows[0].n}`);
    await client.end();
    return true;
  } catch (e) {
    log(`${label}: FAIL (${e.code ?? "?"}) ${e.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

let ok = await tryConnect("direct", cfg);

// Fallback: Supabase transaction pooler is IPv4-reachable and serverless-friendly.
if (!ok) {
  const ref = cfg.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (ref) {
    log("");
    log(`direct failed; trying pooler hosts for project ref "${ref}"`);
    const regions = [
      "aws-0-ap-south-1", "aws-0-us-east-1", "aws-0-us-west-1",
      "aws-0-ap-southeast-1", "aws-0-eu-central-1", "aws-1-ap-south-1",
    ];
    for (const r of regions) {
      const host = `${r}.pooler.supabase.com`;
      try {
        await dns.resolve(host, "A");
      } catch {
        continue;
      }
      const poolCfg = { ...cfg, host, port: 6543, user: `postgres.${ref}` };
      if (await tryConnect(`pooler ${r}:6543`, poolCfg)) {
        log(`\nUSE_POOLER_HOST=${host}`);
        log(`USE_POOLER_USER=postgres.${ref}`);
        ok = true;
        break;
      }
    }
  }
}

log("");
log(ok ? "RESULT: CONNECTED" : "RESULT: NOT CONNECTED");
fs.writeFileSync("conn-report.txt", out.join("\n"), "utf8");
