// The Supabase direct host (db.<ref>.supabase.co) resolves to IPv6 only, which
// Vercel serverless cannot reach. Production must use the Supabase connection
// pooler, which is IPv4-reachable. This finds the correct pooler host/region.
import fs from "node:fs";
import dns from "node:dns/promises";
import pg from "pg";
import { loadEnv, pgConfigFromUrl } from "./db-config.mjs";

const out = [];
const log = (s) => out.push(s);

const env = loadEnv();
const base = pgConfigFromUrl(env.DATABASE_URL);
const ref = base.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];

if (!ref) {
  log("FAIL: could not derive project ref from host " + base.host);
  fs.writeFileSync("pooler-report.txt", out.join("\n"), "utf8");
  process.exit(1);
}
log(`project ref: ${ref}`);

const regions = [
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1",
  "sa-east-1", "ca-central-1",
];

const hosts = [];
for (const r of regions) {
  for (const prefix of ["aws-0", "aws-1"]) hosts.push(`${prefix}-${r}.pooler.supabase.com`);
}

let winner = null;

for (const host of hosts) {
  let v4;
  try {
    v4 = await dns.resolve(host, "A");
  } catch {
    continue; // region host doesn't exist
  }

  // Transaction pooler = 6543, session pooler = 5432
  for (const port of [6543, 5432]) {
    const cfg = { ...base, host, port, user: `postgres.${ref}`, connectionTimeoutMillis: 10000 };
    const client = new pg.Client(cfg);
    try {
      await client.connect();
      const r = await client.query("select 1 as ok");
      if (r.rows[0].ok === 1) {
        log(`OK  ${host}:${port}  (IPv4 ${v4[0]})  user=postgres.${ref}`);
        if (!winner) winner = { host, port, user: `postgres.${ref}`, v4: v4[0] };
      }
      await client.end();
    } catch (e) {
      log(`ERR ${host}:${port}  ${e.code ?? ""} ${String(e.message).slice(0, 80)}`);
      try { await client.end(); } catch {}
    }
  }
  if (winner) break;
}

log("");
if (winner) {
  log("RESULT: POOLER FOUND");
  log(`host=${winner.host}`);
  log(`port=${winner.port}`);
  log(`user=${winner.user}`);
  log("");
  log("Use this connection string shape for production (IPv4-safe):");
  log(`postgresql://${winner.user}:<PASSWORD>@${winner.host}:${winner.port}/postgres`);
} else {
  log("RESULT: NO POOLER REACHABLE");
}

fs.writeFileSync("pooler-report.txt", out.join("\n"), "utf8");
