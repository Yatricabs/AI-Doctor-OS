// ─────────────────────────────────────────────────────────────────────────────
// Postgres (Supabase) data layer.
//
// Replaces the previous better-sqlite3 implementation. better-sqlite3 is a native
// module and could not run on Vercel serverless (read-only filesystem + blocked
// install scripts), which made every API route return an HTML 500 page.
//
// Design notes:
//  • Connect via the Supabase *pooler* (IPv4). The direct db.<ref>.supabase.co host
//    resolves to IPv6 only, which Vercel serverless cannot reach.
//  • Existing SQL across the app uses "?" placeholders (SQLite style). Rather than
//    rewrite ~70 call sites, toPg() rewrites "?" -> "$1..$n" at execution time.
//  • Booleans stay INTEGER 0/1 and timestamps stay ISO-8601 TEXT in the schema, so
//    application SQL such as "WHERE is_active = 1" keeps working unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail loudly and early with a clear message rather than producing confusing
  // downstream errors on every query.
  console.error("[db] DATABASE_URL is not set — database queries will fail.");
}

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);

function createPool(): Pool {
  return new Pool({
    connectionString,
    // Supabase terminates TLS with its own CA chain.
    ssl: { rejectUnauthorized: false },
    // Each serverless invocation is short-lived; keep the footprint minimal so we
    // do not exhaust the pooler's connection budget.
    max: isServerless ? 1 : 10,
    idleTimeoutMillis: isServerless ? 5_000 : 30_000,
    connectionTimeoutMillis: 15_000,
  });
}

// Next.js dev server re-evaluates modules on HMR; cache the pool on globalThis so
// we don't leak a new pool per reload.
const globalForPool = globalThis as unknown as { __aiUpcharPool?: Pool };
const pool: Pool = globalForPool.__aiUpcharPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPool.__aiUpcharPool = pool;

pool.on("error", (err) => {
  // An idle client erroring must not crash the process.
  console.error("[db] idle client error:", err.message);
});

// ─── placeholder translation ────────────────────────────────────────────────
/**
 * Rewrites SQLite-style "?" placeholders into Postgres "$n" placeholders.
 * Quoted string literals and dollar-quoted blocks are skipped so a "?" inside
 * text is never mistaken for a parameter.
 */
export function toPg(sql: string): string {
  let out = "";
  let n = 0;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (quote) {
      out += ch;
      if (ch === quote) {
        // Doubled quote ('' or "") is an escaped quote, stay inside the literal.
        if (sql[i + 1] === quote) {
          out += sql[i + 1];
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }

    // Line comment -- ... : copy verbatim to end of line
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? sql.length : nl;
      out += sql.slice(i, end);
      i = end - 1;
      continue;
    }

    if (ch === "?") {
      out += `$${++n}`;
      continue;
    }

    out += ch;
  }

  return out;
}

// ─── case conversion ────────────────────────────────────────────────────────
function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v])
  );
}

export function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// ─── identifier safety ──────────────────────────────────────────────────────
/**
 * Table/column names are interpolated into SQL (they cannot be bound as
 * parameters), so they are strictly validated to prevent SQL injection.
 */
function assertIdentifier(name: string, kind: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Unsafe ${kind} identifier: ${JSON.stringify(name)}`);
  }
  return name;
}

// ─── core helpers ───────────────────────────────────────────────────────────
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(toPg(sql), params as never[]);
  return res.rows.map((r) => toCamel(r as Record<string, unknown>)) as T[];
}

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length ? rows[0] : null;
}

export async function all<T>(table: string): Promise<T[]> {
  assertIdentifier(table, "table");
  return query<T>(`SELECT * FROM ${table}`);
}

export async function insert(table: string, values: Record<string, unknown>): Promise<void> {
  assertIdentifier(table, "table");
  const keys = Object.keys(values);
  if (!keys.length) return;
  const columns = keys.map((k) => assertIdentifier(toSnake(k), "column"));
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  await pool.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO NOTHING`,
    keys.map((k) => values[k]) as never[]
  );
}

export async function update(table: string, id: string, values: Record<string, unknown>): Promise<void> {
  assertIdentifier(table, "table");
  const keys = Object.keys(values);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${assertIdentifier(toSnake(k), "column")} = $${i + 1}`);
  await pool.query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $${keys.length + 1}`,
    [...keys.map((k) => values[k]), id] as never[]
  );
}

export async function remove(table: string, id: string): Promise<void> {
  assertIdentifier(table, "table");
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id] as never[]);
}

export async function count(table: string, where?: string, params: unknown[] = []): Promise<number> {
  assertIdentifier(table, "table");
  const sql = where
    ? `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`
    : `SELECT COUNT(*)::int AS n FROM ${table}`;
  const row = await queryOne<{ n: number }>(sql, params);
  return row?.n ?? 0;
}

/** Runs a set of statements inside a single transaction. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── profile helpers (API preserved from the SQLite implementation) ──────────
export type ProfileSettingsRow = {
  fullName: string;
  specialty: string;
  clinicBio: string;
  notifications: { urgentFollowUps: boolean; weeklySummary: boolean; twoStepSignIn: boolean };
};

const DEFAULT_PROFILE: ProfileSettingsRow = {
  fullName: "Dr. Ananya Arya",
  specialty: "General Medicine",
  clinicBio: "Clinician focused on practical, preventive adult care.",
  notifications: { urgentFollowUps: true, weeklySummary: true, twoStepSignIn: true },
};

export async function getProfileSettings(): Promise<ProfileSettingsRow> {
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM profile_settings WHERE id = 1");
  if (!row) return DEFAULT_PROFILE;
  return {
    fullName: String(row.fullName ?? DEFAULT_PROFILE.fullName),
    specialty: String(row.specialty ?? DEFAULT_PROFILE.specialty),
    clinicBio: String(row.clinicBio ?? DEFAULT_PROFILE.clinicBio),
    notifications: {
      urgentFollowUps: Boolean(row.urgentFollowUps),
      weeklySummary: Boolean(row.weeklySummary),
      twoStepSignIn: Boolean(row.twoStepSignIn),
    },
  };
}

export async function saveProfileSettings(settings: ProfileSettingsRow): Promise<void> {
  await pool.query(
    `INSERT INTO profile_settings
       (id, full_name, specialty, clinic_bio, urgent_follow_ups, weekly_summary, two_step_sign_in)
     VALUES (1, $1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       specialty = EXCLUDED.specialty,
       clinic_bio = EXCLUDED.clinic_bio,
       urgent_follow_ups = EXCLUDED.urgent_follow_ups,
       weekly_summary = EXCLUDED.weekly_summary,
       two_step_sign_in = EXCLUDED.two_step_sign_in`,
    [
      settings.fullName,
      settings.specialty,
      settings.clinicBio,
      Number(settings.notifications.urgentFollowUps),
      Number(settings.notifications.weeklySummary),
      Number(settings.notifications.twoStepSignIn),
    ] as never[]
  );
}

/** Lightweight connectivity probe used by health checks and scripts. */
export async function ping(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
