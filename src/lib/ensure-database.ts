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
    message.includes("connection pool") ||
    message.includes("Timed out fetching a new connection") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT")
  );
}

async function usersTableExists() {
  try {
    await prisma.user.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (isMissingUsersTable(error)) return false;
    throw error;
  }
}

/**
 * Verifies PostgreSQL schema exists before auth/CRUD queries.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        const exists = await usersTableExists();
        if (!exists) {
          throw new DatabaseNotReadyError(
            "Database tables are not initialized. Set NETLIFY_RUN_MIGRATIONS=true on deploy, or POST /api/setup/seed after setting DIRECT_URL."
          );
        }
      } catch (error) {
        if (error instanceof DatabaseNotReadyError) throw error;
        if (isConnectionError(error)) {
          throw new DatabaseNotReadyError(
            "Cannot connect to PostgreSQL. Verify DATABASE_URL in Netlify Runtime env (Neon pooled URL, no quotes)."
          );
        }
        throw error;
      }
    })();
  }

  await schemaReady;
}
