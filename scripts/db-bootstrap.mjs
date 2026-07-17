#!/usr/bin/env node
/**
 * Production database bootstrap (Netlify build + manual recovery):
 * 1. Validate DATABASE_URL / DIRECT_URL
 * 2. prisma migrate deploy (with retries for Neon cold-start)
 * 3. Verify public.users exists
 * 4. Fallback: prisma db push if migrations did not create schema
 * 5. Seed locally only (Netlify uses runtime ensureSuperAdmin on first login)
 */
import "./load-env.mjs";
import { spawnSync } from "node:child_process";
import { preparePrismaEnv } from "./prisma-env.mjs";

const MAX_ATTEMPTS = Number(process.env.PRISMA_MIGRATE_RETRIES || 6);
const DELAY_MS = Number(process.env.PRISMA_MIGRATE_RETRY_DELAY_MS || 8000);
const isNetlifyBuild = process.env.NETLIFY === "true";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(cmd, args, label) {
  console.log(`[lexcore] ${label}`);
  return spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
}

async function usersTableExists() {
  const { PrismaClient } = await import("@prisma/client");
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });

  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
      LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function listPublicTables() {
  const { PrismaClient } = await import("@prisma/client");
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });

  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    return rows.map((r) => r.name);
  } finally {
    await prisma.$disconnect();
  }
}

function migrateDeployWithRetries() {
  let lastStatus = 1;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[lexcore] prisma migrate deploy (attempt ${attempt}/${MAX_ATTEMPTS})`);
    const result = run("npx", ["prisma", "migrate", "deploy"], "Applying migrations");
    lastStatus = result.status ?? 1;
    if (lastStatus === 0) return 0;
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[lexcore] migrate failed — retrying in ${DELAY_MS}ms (Neon may be waking up)`);
      sleep(DELAY_MS);
    }
  }
  return lastStatus;
}

async function main() {
  try {
    const { host, directUrl } = preparePrismaEnv();
    console.log(`[lexcore] Runtime DATABASE_URL host: ${host}`);
    console.log(`[lexcore] Migration DIRECT_URL host: ${new URL(directUrl).hostname}`);
  } catch (error) {
    console.error(`[lexcore] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const migrateStatus = migrateDeployWithRetries();
  if (migrateStatus !== 0) {
    console.warn("[lexcore] migrate deploy did not succeed — will attempt db push if schema is missing");
  }

  let hasUsers = await usersTableExists();

  if (!hasUsers) {
    console.warn("[lexcore] public.users missing — running prisma db push to sync schema");
    const push = run("npx", ["prisma", "db", "push", "--skip-generate"], "Syncing schema via db push");
    if ((push.status ?? 1) !== 0) {
      console.error("[lexcore] prisma db push failed — cannot create database tables");
      process.exit(push.status ?? 1);
    }
    hasUsers = await usersTableExists();
  }

  if (!hasUsers) {
    const tables = await listPublicTables();
    console.error(
      "[lexcore] FATAL: public.users still missing after migrate + db push.\n" +
        `Existing tables: ${tables.length ? tables.join(", ") : "(none)"}\n` +
        "Verify DATABASE_URL and DIRECT_URL point to the same Neon database."
    );
    process.exit(1);
  }

  const tables = await listPublicTables();
  console.log(`[lexcore] Schema OK — ${tables.length} public tables including users`);

  if (isNetlifyBuild) {
    console.log(
      "[lexcore] Netlify build — skipping seed step. Super Admin is created automatically on first login."
    );
    return;
  }

  const seed = run("node", ["scripts/seed-admin.mjs"], "Seeding Super Admin + staff + settings");
  if ((seed.status ?? 1) !== 0) {
    console.error("[lexcore] Seed failed — tables exist but Super Admin was not created");
    process.exit(seed.status ?? 1);
  }

  console.log("[lexcore] Database bootstrap complete.");
}

main().catch((err) => {
  console.error("[lexcore] Bootstrap error:", err);
  process.exit(1);
});
