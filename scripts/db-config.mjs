// Shared Postgres connection config for the setup/verification scripts.
//
// DATABASE_URL cannot be parsed with the URL class here because the Supabase
// password contains an unencoded "@". We therefore split on the LAST "@" so the
// password is preserved verbatim, and build an explicit pg config object.
import fs from "node:fs";

export function loadEnv(file = ".env.local") {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Build a pg client config from a postgres:// URL that may contain an unescaped "@". */
export function pgConfigFromUrl(url) {
  const withoutScheme = url.replace(/^postgres(ql)?:\/\//, "");
  const at = withoutScheme.lastIndexOf("@");
  if (at < 0) throw new Error("DATABASE_URL missing '@' separator");

  const userinfo = withoutScheme.slice(0, at);
  const hostpart = withoutScheme.slice(at + 1);

  const colon = userinfo.indexOf(":");
  const rawUser = colon < 0 ? userinfo : userinfo.slice(0, colon);
  const rawPassword = colon < 0 ? "" : userinfo.slice(colon + 1);

  // The URL may store these percent-encoded (the password contains "@"). Decode so
  // the literal credential is sent. Decoding a non-encoded value is a no-op, so this
  // is safe for both encoded and raw forms.
  const safeDecode = (s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const user = safeDecode(rawUser);
  const password = safeDecode(rawPassword);

  const slash = hostpart.indexOf("/");
  const hostPort = slash < 0 ? hostpart : hostpart.slice(0, slash);
  const database = slash < 0 ? "postgres" : hostpart.slice(slash + 1).split("?")[0];

  const [host, portStr] = hostPort.split(":");
  const port = portStr ? Number(portStr) : 5432;

  return {
    host,
    port,
    user,
    password,
    database,
    // Supabase terminates TLS with its own CA; verification is not required for
    // these one-off admin/setup connections.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  };
}

export function describe(cfg) {
  return `host=${cfg.host} port=${cfg.port} user=${cfg.user} db=${cfg.database} passwordLen=${cfg.password.length}`;
}
