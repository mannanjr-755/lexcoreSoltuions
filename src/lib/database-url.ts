/**
 * Shared PostgreSQL URL validation and Neon serverless normalization.
 */

export function stripWrappingQuotes(value: unknown): string {
  if (typeof value !== "string") return "";
  let url = value.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  return url;
}

export function getRawDatabaseUrl(): string {
  return stripWrappingQuotes(
    process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? ""
  );
}

export function assertValidDatabaseUrl(url: string, label = "DATABASE_URL"): URL {
  if (!url) {
    throw new Error(
      `${label} is missing. Set it in Netlify → Site configuration → Environment variables ` +
        `(Runtime). Use your Neon connection string from https://console.neon.tech`
    );
  }

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(`${label} must start with postgresql:// or postgres://`);
  }

  let parsed: URL;
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

/**
 * Neon pooler + Prisma on Netlify/serverless: channel_binding=require often breaks connections.
 */
export function normalizeDatabaseUrl(raw: string, options: { pooler?: boolean; connectTimeoutSec?: number } = {}) {
  const parsed = assertValidDatabaseUrl(raw, "DATABASE_URL");
  parsed.searchParams.delete("channel_binding");

  if (!parsed.searchParams.get("sslmode")) {
    parsed.searchParams.set("sslmode", "require");
  }

  const timeout = options.connectTimeoutSec ?? 30;
  if (!parsed.searchParams.get("connect_timeout")) {
    parsed.searchParams.set("connect_timeout", String(timeout));
  }

  if (options.pooler ?? parsed.hostname.includes("-pooler.")) {
    parsed.searchParams.delete("pgbouncer");
    if (parsed.hostname.includes("-pooler.")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
  } else {
    parsed.searchParams.delete("pgbouncer");
  }

  return parsed.toString();
}

export function resolveRuntimeDatabaseUrl(): string {
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

  return normalizeDatabaseUrl(raw, { pooler: true, connectTimeoutSec: 30 });
}

export function assertAuthEnv(): { accessSecret: string; refreshSecret: string } {
  const accessSecret = process.env.JWT_ACCESS_SECRET?.trim();
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();

  if (!accessSecret || accessSecret.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET is missing or too short (min 32 chars). Set it in Netlify → Environment variables → Runtime."
    );
  }
  if (!refreshSecret || refreshSecret.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET is missing or too short (min 32 chars). Set it in Netlify → Environment variables → Runtime."
    );
  }

  return { accessSecret, refreshSecret };
}

export function getSuperAdminConfig() {
  return {
    email: (process.env.SUPER_ADMIN_EMAIL ?? "admin@lexcore.com").toLowerCase().trim(),
    password: process.env.SUPER_ADMIN_PASSWORD ?? "Lexcore@2026!",
    name: process.env.SUPER_ADMIN_NAME ?? "Super Admin"
  };
}
