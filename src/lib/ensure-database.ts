import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

let schemaReady: Promise<void> | null = null;

function prepareDirectUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || process.env.DIRECT_URL?.trim()) return;

  try {
    const parsed = new URL(raw);
    parsed.hostname = parsed.hostname.replace("-pooler.", ".");
    parsed.searchParams.delete("pgbouncer");
    if (!parsed.searchParams.get("sslmode")) parsed.searchParams.set("sslmode", "require");
    if (!parsed.searchParams.get("connect_timeout")) parsed.searchParams.set("connect_timeout", "60");
    process.env.DIRECT_URL = parsed.toString();
  } catch {
    process.env.DIRECT_URL = raw;
  }
}

function runPrismaCli(args: string[], label: string) {
  prepareDirectUrl();
  const prismaEntry = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  logger.warn(`[lexcore] ${label}`);
  try {
    execFileSync(process.execPath, [prismaEntry, ...args], {
      env: process.env,
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const detail = [err.stderr, err.stdout, err.message].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed.\n${detail}`);
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
 * Ensures PostgreSQL schema exists before auth/CRUD queries.
 * Used on Netlify when build-time migrations were skipped.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      if (await usersTableExists()) return;

      try {
        await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
        return;
      } catch (error) {
        if (!isMissingUsersTable(error)) throw error;
      }

      try {
        runPrismaCli(["migrate", "deploy"], "Applying migrations (runtime)");
      } catch (migrateError) {
        logger.warn("Runtime migrate deploy failed, trying db push", {
          error: migrateError instanceof Error ? migrateError.message : String(migrateError)
        });
        runPrismaCli(["db", "push", "--skip-generate", "--accept-data-loss"], "Syncing schema via db push");
      }

      if (!(await usersTableExists())) {
        throw new Error(
          "Database schema is still missing. Set DATABASE_URL and DIRECT_URL in Netlify (Runtime scope) and retry login."
        );
      }

      logger.info("Database schema created at runtime");
    })();
  }

  await schemaReady;
}
