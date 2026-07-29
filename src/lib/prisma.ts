import { PrismaClient } from "@prisma/client";
import { resolveRuntimeDatabaseUrl } from "@/lib/database-url";
import { withDbRetry } from "@/lib/db-retry";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnecting: Promise<void> | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = resolveRuntimeDatabaseUrl();

  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

  // Auto-retry transient pool / connection failures on every query.
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        return withDbRetry(() => query(args), { label: "prisma.query", retries: 4, baseDelayMs: 80 });
      }
    }
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

/** Ensures the singleton client has an open connection (safe to call repeatedly). */
export async function ensurePrismaConnected() {
  if (!globalForPrisma.prismaConnecting) {
    globalForPrisma.prismaConnecting = prisma
      .$connect()
      .catch((error) => {
        globalForPrisma.prismaConnecting = undefined;
        throw error;
      });
  }
  await globalForPrisma.prismaConnecting;
}

export default prisma;
