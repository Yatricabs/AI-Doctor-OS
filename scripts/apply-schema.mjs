// Applies supabase/schema.sql to the Supabase database, then rewrites
// .env.local's DATABASE_URL to the IPv4 pooler form so local development
// exercises the same connection path production (Vercel) will use.
import fs from "node:fs";
import pg from "pg";
import { loadEnv, pgConfigFromUrl } from "./db-config.mjs";

const out = [];
const log = (s) => out.push(s);

const POOLER_HOST = "aws-0-ap-south-1.pooler.supabase.com";
const POOLER_PORT = 6543;

const env = loadEnv();
const base = pgConfigFromUrl(env.DATABASE_URL);
const ref = base.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ?? base.user.split(".")[1];

// DDL runs over the session/direct connection (transaction pooling is not ideal
// for multi-statement DDL scripts).
const ddlCfg = base.host.includes("pooler")
  ? { ...base, port: 5432 }
  : base;

const schema = fs.readFileSync("supabase/schema.sql", "utf8");

const client = new pg.Client(ddlCfg);
try {
  await client.connect();
  log(`connected for DDL: host=${ddlCfg.host} port=${ddlCfg.port}`);

  await client.query(schema);
  log("schema applied OK");

  const t = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name"
  );
  log(`public tables now: ${t.rowCount}`);
  for (const r of t.rows) log("  " + r.table_name);

  await client.end();
} catch (e) {
  log(`FAIL applying schema: ${e.code ?? ""} ${e.message}`);
  if (e.position) log(`  at character position ${e.position}`);
  try { await client.end(); } catch {}
  fs.writeFileSync("apply-schema-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}

// ── point DATABASE_URL at the IPv4 pooler ──
const poolerUrl = `postgresql://postgres.${ref}:${encodeURIComponent(base.password)}@${POOLER_HOST}:${POOLER_PORT}/postgres`;

let envText = fs.readFileSync(".env.local", "utf8");
if (/^DATABASE_URL=/m.test(envText)) {
  envText = envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${poolerUrl}`);
} else {
  envText += `\nDATABASE_URL=${poolerUrl}\n`;
}
// SQLite is being removed; drop its stale setting.
envText = envText.replace(/^SQLITE_DATABASE_PATH=.*\r?\n?/m, "");
fs.writeFileSync(".env.local", envText, "utf8");
log("");
log(`.env.local DATABASE_URL -> pooler (${POOLER_HOST}:${POOLER_PORT}), password URL-encoded`);
log("SQLITE_DATABASE_PATH removed from .env.local");

fs.writeFileSync("apply-schema-report.txt", out.join("\n"), "utf8");
