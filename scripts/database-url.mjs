/**
 * Shared PostgreSQL URL validation — no placeholder heuristics.
 * Accepts any valid postgresql:// or postgres:// URL from process.env.
 */

export function stripWrappingQuotes(value) {
  if (typeof value !== "string") return value;
  let url = value.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  return url;
}

export function getRawDatabaseUrl() {
  return stripWrappingQuotes(
    process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ""
  );
}

export function assertValidDatabaseUrl(url, label = "DATABASE_URL") {
  if (!url) {
    throw new Error(
      `${label} is missing. Set it in Netlify → Site configuration → Environment variables ` +
        `(Builds + Runtime). Use your Neon connection string from https://console.neon.tech`
    );
  }

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(`${label} must start with postgresql:// or postgres://`);
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL. URL-encode special characters in the password (e.g. @ → %40).`);
  }

  if (!parsed.hostname) {
    throw new Error(`${label} must include a database hostname.`);
  }

  return parsed;
}

/** Prefer Neon's non-pooler host for migrations (Prisma directUrl). */
export function toDirectConnectionUrl(pooledOrDirectUrl) {
  const url = stripWrappingQuotes(pooledOrDirectUrl);
  assertValidDatabaseUrl(url, "DIRECT_URL");
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace("-pooler.", ".");
  parsed.searchParams.delete("pgbouncer");
  ensureSslAndTimeout(parsed, 60);
  return parsed.toString();
}

/** Pooled URL for serverless runtime. */
export function toPooledRuntimeUrl(anyUrl) {
  const url = stripWrappingQuotes(anyUrl);
  assertValidDatabaseUrl(url, "DATABASE_URL");
  const parsed = new URL(url);
  ensureSslAndTimeout(parsed, 30);
  if (parsed.hostname.includes("-pooler.") && !parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true");
  }
  return parsed.toString();
}

function ensureSslAndTimeout(parsedUrl, connectTimeoutSec) {
  if (!parsedUrl.searchParams.get("sslmode")) {
    parsedUrl.searchParams.set("sslmode", "require");
  }
  if (!parsedUrl.searchParams.get("connect_timeout")) {
    parsedUrl.searchParams.set("connect_timeout", String(connectTimeoutSec));
  }
}

export function preparePrismaEnv() {
  const raw = getRawDatabaseUrl();
  assertValidDatabaseUrl(raw, "DATABASE_URL");

  const runtimeUrl = toPooledRuntimeUrl(raw);
  const directUrl = stripWrappingQuotes(process.env.DIRECT_URL)
    ? toDirectConnectionUrl(process.env.DIRECT_URL)
    : toDirectConnectionUrl(raw);

  process.env.DATABASE_URL = runtimeUrl;
  process.env.DIRECT_URL = directUrl;

  return { runtimeUrl, directUrl, host: new URL(runtimeUrl).hostname };
}

export function resolveRuntimeDatabaseUrl() {
  const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export";

  const raw = getRawDatabaseUrl();

  if (!raw) {
    if (isBuildPhase) {
      return "postgresql://build:build@127.0.0.1:5432/build?schema=public";
    }
    throw new Error(
      "DATABASE_URL is missing at runtime. In Netlify → Environment variables, set DATABASE_URL " +
        "(Neon pooled URL) for Runtime. Do not wrap the value in quotes."
    );
  }

  assertValidDatabaseUrl(raw, "DATABASE_URL");

  try {
    const parsed = new URL(raw);
    if (!parsed.searchParams.get("sslmode")) parsed.searchParams.set("sslmode", "require");
    if (!parsed.searchParams.get("connect_timeout")) parsed.searchParams.set("connect_timeout", "30");
    return parsed.toString();
  } catch {
    throw new Error("DATABASE_URL is invalid. URL-encode special characters in the password.");
  }
}
