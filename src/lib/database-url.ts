/**
 * Shared PostgreSQL URL validation — no placeholder heuristics.
 * Accepts any valid postgresql:// or postgres:// URL from process.env.
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
        `(Builds + Runtime). Use your Neon connection string from https://console.neon.tech`
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

  assertValidDatabaseUrl(raw, "DATABASE_URL");

  const parsed = new URL(raw);
  if (!parsed.searchParams.get("sslmode")) parsed.searchParams.set("sslmode", "require");
  if (!parsed.searchParams.get("connect_timeout")) parsed.searchParams.set("connect_timeout", "30");
  return parsed.toString();
}
