#!/usr/bin/env node
/** Ensures Prisma generate always has DATABASE_URL + DIRECT_URL set (even dummies are rejected if invalid). */
import "./load-env.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { preparePrismaEnv, getRawDatabaseUrl } from "./prisma-env.mjs";

try {
  if (getRawDatabaseUrl()) {
    preparePrismaEnv();
  } else {
    // generate does not need a live DB; provide a local stub for Prisma CLI parsing only
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://generate:generate@127.0.0.1:5432/generate?schema=public";
    process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
    console.warn("[lexcore] DATABASE_URL unset during generate — using local stub for Prisma CLI only.");
  }
} catch (error) {
  // During postinstall on a fresh clone without env, still allow generate with stub
  console.warn(`[lexcore] preparePrismaEnv warning: ${error instanceof Error ? error.message : error}`);
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://generate:generate@127.0.0.1:5432/generate?schema=public";
  process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
}

const MAX_ATTEMPTS = process.platform === "win32" ? 4 : 2;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(stderrText) {
  const normalized = (stderrText || "").toLowerCase();
  return (
    normalized.includes("eperm") ||
    normalized.includes("ebusy") ||
    normalized.includes("operation not permitted") ||
    normalized.includes("resource busy")
  );
}

function hasUsableGeneratedClient() {
  const generatedClient = "node_modules/.prisma/client/index.js";
  const prismaClientEntry = "node_modules/@prisma/client/index.js";
  const queryEngine = "node_modules/.prisma/client/query_engine-windows.dll.node";
  return existsSync(generatedClient) && existsSync(prismaClientEntry) && existsSync(queryEngine);
}

async function runGenerateWithRetry() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = spawnSync("npx", ["prisma", "generate"], {
      stdio: "pipe",
      env: process.env,
      shell: true,
      encoding: "utf8"
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (result.status === 0) {
      return 0;
    }

    const stderrText = String(result.stderr ?? "");
    const canRetry = attempt < MAX_ATTEMPTS && shouldRetry(stderrText);

    if (!canRetry) {
      if (process.platform === "win32" && shouldRetry(stderrText) && hasUsableGeneratedClient()) {
        console.warn(
          "[lexcore] Prisma generate hit a Windows file lock, but an existing generated client is available. Continuing build."
        );
        return 0;
      }
      return result.status ?? 1;
    }

    if (process.platform === "win32") {
      try {
        rmSync("node_modules/.prisma/client", { recursive: true, force: true });
      } catch {
        // Best effort cleanup only.
      }
    }

    const delay = attempt * 1500;
    console.warn(
      `[lexcore] Prisma generate lock detected (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${delay}ms...`
    );
    await wait(delay);
  }

  return 1;
}

const exitCode = await runGenerateWithRetry();
process.exit(exitCode);
