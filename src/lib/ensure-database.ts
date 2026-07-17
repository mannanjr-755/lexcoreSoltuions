import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let schemaReady: Promise<void> | null = null;

export class DatabaseNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseNotReadyError";
  }
}

function isMissingUsersTable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2010";
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    (message.includes("public.users") || message.includes('"users"')) &&
    message.includes("does not exist")
  );
}

function isConnectionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1000" || error.code === "P1017";
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Can't reach database") ||
    message.includes("Connection") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT")
  );
}

async function usersTableExists() {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Verifies PostgreSQL schema exists before auth/CRUD queries.
 * Does not spawn Prisma CLI (unsupported on Netlify serverless functions).
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        if (await usersTableExists()) return;
        await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
      } catch (error) {
        if (isConnectionError(error)) {
          throw new DatabaseNotReadyError(
            "Cannot connect to PostgreSQL. Verify DATABASE_URL in Netlify Runtime env (Neon pooled URL, no quotes)."
          );
        }
        if (isMissingUsersTable(error)) {
          throw new DatabaseNotReadyError(
            "Database tables are not initialized. Run migrations via NETLIFY_RUN_MIGRATIONS=true on deploy, or POST /api/setup/seed after setting DIRECT_URL."
          );
        }
        throw error;
      }
    })();
  }

  await schemaReady;
}
