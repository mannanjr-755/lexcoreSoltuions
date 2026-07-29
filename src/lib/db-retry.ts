import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server was reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024" // Timed out fetching a new connection from the connection pool
]);

export type DbRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  label?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Timed out fetching a new connection") ||
    message.includes("connection pool") ||
    message.includes("Can't reach database") ||
    message.includes("Connection reset") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED") ||
    message.includes("server closed the connection") ||
    message.includes("too many clients") ||
    message.includes("remaining connection slots") ||
    /40P01|55P03|53300|57P01/i.test(message) // deadlock / lock_not_available / too_many_connections / admin_shutdown
  );
}

/**
 * Retries transient PostgreSQL / Prisma pool errors with exponential backoff + jitter.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: DbRetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 75;
  const label = options.label ?? "db";

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === retries) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 40);
      logger.warn("Transient database error — retrying", {
        label,
        attempt: attempt + 1,
        retries,
        delayMs: delay,
        code:
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
        message: error instanceof Error ? error.message : String(error)
      });
      await sleep(delay);
    }
  }

  throw lastError;
}
