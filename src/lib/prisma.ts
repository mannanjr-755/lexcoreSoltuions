import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const PLACEHOLDER_PATTERNS = [
  /ep-xxxx/i,
  /region\.aws\.neon\.tech/i,
  /USER:PASSWORD/i,
  /:PASSWORD@/i,
  /@HOST[/:]/i,
  /johndoe:randompassword/i,
  /your-neon/i
];

/**
 * Netlify Functions do not ship a `.env` file. Always pass URL explicitly.
 * Also reject placeholder hosts that cause P1001 DNS failures.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
  const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export";

  if (!raw || !raw.trim()) {
    if (isBuildPhase) {
      return "postgresql://build:build@127.0.0.1:5432/build?schema=public";
    }
    throw new Error(
      "DATABASE_URL is missing at runtime. In Netlify → Environment variables, set DATABASE_URL " +
        "(Neon pooled URL) for Builds AND Runtime. Do not wrap the value in quotes."
    );
  }

  let url = raw.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must start with postgresql:// or postgres://");
  }

  if (!isBuildPhase) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(url)) {
        throw new Error(
          "DATABASE_URL contains a placeholder (ep-xxxx / region.aws / USER:PASSWORD). " +
            "Paste the real connection string from https://console.neon.tech → Connect."
        );
      }
    }
  }

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.get("sslmode")) parsed.searchParams.set("sslmode", "require");
    if (!parsed.searchParams.get("connect_timeout")) parsed.searchParams.set("connect_timeout", "30");
    return parsed.toString();
  } catch {
    throw new Error("DATABASE_URL is invalid. URL-encode special characters in the password.");
  }
}

function createPrismaClient() {
  const url = resolveDatabaseUrl();

  return new PrismaClient({
    datasources: {
      db: { url }
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    const client = globalForPrisma.prisma;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  }
});

export default prisma;
