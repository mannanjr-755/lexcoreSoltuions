import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Netlify serverless functions do NOT ship a `.env` file.
 * Prisma's schema `env("DATABASE_URL")` auto-loader often fails there even when
 * Netlify injects `process.env.DATABASE_URL`. Always pass the URL explicitly.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
  if (!raw || !raw.trim()) {
    throw new Error(
      "DATABASE_URL is missing at runtime. In Netlify → Site settings → Environment variables, " +
        "set DATABASE_URL (Neon pooled connection string) for Production + Deploy Previews + Branch deploys, " +
        "scopes: Builds AND Functions/Runtime. Do not wrap the value in quotes."
    );
  }

  // Netlify UI sometimes stores values with surrounding quotes — strip them.
  let url = raw.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL must start with postgresql:// or postgres://. Check Netlify env value (no accidental quotes/spaces)."
    );
  }

  return url;
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

/**
 * Lazy singleton — avoids constructing PrismaClient during module evaluation
 * before Netlify has injected runtime env into the function process.
 */
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
