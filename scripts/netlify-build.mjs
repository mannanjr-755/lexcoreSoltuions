#!/usr/bin/env node
/**
 * Netlify-safe production build orchestrator.
 *
 * Compile step (always runs):
 *   1. prisma generate
 *   2. next build
 *
 * Database migrations are NOT required to compile Next.js on Netlify.
 * Schema is applied at runtime via ensureDatabaseSchema() on first API request,
 * or manually via: npm run db:setup
 */
import "./load-env.mjs";
import { spawnSync } from "node:child_process";
import { getRawDatabaseUrl, assertValidDatabaseUrl } from "./prisma-env.mjs";

const isNetlify = process.env.NETLIFY === "true";
const runMigrationsInBuild = process.env.NETLIFY_RUN_MIGRATIONS === "true";

function runStep(label, command, args) {
  console.log(`\n[lexcore] === ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    console.error(`[lexcore] FAILED at step "${label}" (exit ${result.status ?? 1})`);
    process.exit(result.status ?? 1);
  }
}

function tryDatabaseBootstrap() {
  const raw = getRawDatabaseUrl();
  if (!raw) {
    console.warn(
      "[lexcore] DATABASE_URL not set — skipping database bootstrap.\n" +
        "Set DATABASE_URL in Netlify (Runtime scope minimum). Schema is created on first login."
    );
    return;
  }

  try {
    assertValidDatabaseUrl(raw, "DATABASE_URL");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[lexcore] Skipping database bootstrap: ${message}`);
    return;
  }

  console.log("\n[lexcore] === Database Bootstrap (optional) ===");
  const result = spawnSync("node", ["scripts/db-bootstrap.mjs"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    console.warn(
      "[lexcore] Database bootstrap failed (exit " +
        (result.status ?? 1) +
        "). Continuing build — schema will be applied at runtime on first request."
    );
  }
}

runStep("Prisma Generate", "node", ["scripts/prisma-generate.mjs"]);

if (isNetlify) {
  if (runMigrationsInBuild) {
    console.log("[lexcore] NETLIFY_RUN_MIGRATIONS=true — attempting build-time database bootstrap.");
    tryDatabaseBootstrap();
  } else {
    console.log(
      "[lexcore] Netlify compile step — skipping database bootstrap.\n" +
        "  • Set DATABASE_URL + DIRECT_URL in Netlify → Environment variables → Runtime (and Builds if you want build-time migrate).\n" +
        "  • Tables are created automatically on first login via /api/auth/login.\n" +
        "  • Or set NETLIFY_RUN_MIGRATIONS=true to run migrations during build."
    );
  }
} else {
  tryDatabaseBootstrap();
}

runStep("Next.js Build", "npx", ["next", "build"]);

console.log("\n[lexcore] Production build completed successfully.");
