import { spawnSync } from "node:child_process";
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
    process.env.DIRECT_URL = parsed.toString();
  } catch {
    process.env.DIRECT_URL = raw;
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

function runPrismaDbPush(): void {
  prepareDirectUrl();
  logger.warn("public.users missing — running prisma db push to create schema");
  const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    env: process.env,
    shell: true,
    encoding: "utf-8",
    timeout: 120_000
  });

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      `Failed to create database tables automatically. Run npm run db:setup or redeploy with a valid DATABASE_URL.\n${detail}`
    );
  }
}

/**
 * Ensures PostgreSQL schema exists before auth/CRUD queries.
 * Build-time migrate is preferred; this is a runtime safety net for empty Neon databases.
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

      runPrismaDbPush();

      if (!(await usersTableExists())) {
        throw new Error(
          "Database schema is still missing after prisma db push. Verify DATABASE_URL and DIRECT_URL in Netlify."
        );
      }

      logger.info("Database schema created via runtime db push");
    })();
  }

  await schemaReady;
}
