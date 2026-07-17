#!/usr/bin/env node
/**
 * Netlify-safe production build orchestrator.
 * 1. prisma generate (no live DB required)
 * 2. db-bootstrap only when DATABASE_URL is valid (migrate + optional local seed)
 * 3. next build
 */
import "./load-env.mjs";
import { spawnSync } from "node:child_process";
import { getRawDatabaseUrl, assertValidDatabaseUrl } from "./prisma-env.mjs";

const isCi = process.env.NETLIFY === "true" || process.env.CI === "true";

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

function shouldRunDatabaseBootstrap() {
  const raw = getRawDatabaseUrl();
  if (!raw) {
    if (isCi) {
      console.error(
        "[lexcore] DATABASE_URL is missing during Netlify build.\n" +
          "Set DATABASE_URL (Neon pooled URL) under Site configuration → Environment variables → Builds scope."
      );
      process.exit(1);
    }
    console.warn("[lexcore] DATABASE_URL unset — skipping database bootstrap for local build.");
    return false;
  }

  try {
    assertValidDatabaseUrl(raw, "DATABASE_URL");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isCi) {
      console.error(`[lexcore] ${message}`);
      process.exit(1);
    }
    console.warn(`[lexcore] Skipping database bootstrap: ${message}`);
    return false;
  }
}

runStep("Prisma Generate", "node", ["scripts/prisma-generate.mjs"]);

if (shouldRunDatabaseBootstrap()) {
  runStep("Database Bootstrap", "node", ["scripts/db-bootstrap.mjs"]);
}

runStep("Next.js Build", "npx", ["next", "build"]);

console.log("\n[lexcore] Production build completed successfully.");
