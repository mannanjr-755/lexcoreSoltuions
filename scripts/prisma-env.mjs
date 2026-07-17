/**
 * Shared Neon/Prisma DATABASE_URL helpers for Netlify builds + runtime.
 */

const PLACEHOLDER_PATTERNS = [
  /ep-xxxx/i,
  /region\.aws\.neon\.tech/i,
  /USER:PASSWORD/i,
  /:PASSWORD@/i,
  /@HOST[/:]/i,
  /johndoe:randompassword/i,
  /localhost:5432\/mydb/i,
  /your-neon/i,
  /example\.neon\.tech/i
];

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
        `(Builds + Runtime). Use your real Neon connection string from https://console.neon.tech`
    );
  }

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(`${label} must start with postgresql:// or postgres://`);
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `${label} still contains a placeholder value (${pattern}). ` +
          `Replace it with the real connection string from Neon Console → Connection Details. ` +
          `Do not use ep-xxxx / region.aws / USER:PASSWORD examples.`
      );
    }
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL. Check password URL-encoding (e.g. @ → %40).`);
  }

  if (!parsed.hostname.includes("neon.tech") && !process.env.ALLOW_NON_NEON_DATABASE) {
    // Allow other Postgres hosts in local/dev when explicitly permitted; warn otherwise.
    console.warn(
      `[lexcore] ${label} host is "${parsed.hostname}" (not *.neon.tech). Continuing anyway.`
    );
  }

  return parsed;
}

/** Prefer Neon's non-pooler host for migrations (Prisma directUrl). */
export function toDirectConnectionUrl(pooledOrDirectUrl) {
  const url = stripWrappingQuotes(pooledOrDirectUrl);
  assertValidDatabaseUrl(url, "DATABASE_URL");
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace("-pooler.", ".");
  // Migrations should not use pgbouncer params
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
  // Helpful for Neon serverless pooler
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

/**
 * Prepare process.env for Prisma CLI (generate / migrate) and runtime.
 * Sets DATABASE_URL (runtime/pool-friendly) and DIRECT_URL (migrate/direct).
 */
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
