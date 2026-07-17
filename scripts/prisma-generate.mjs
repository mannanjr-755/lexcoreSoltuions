#!/usr/bin/env node
/** Ensures Prisma generate always has DATABASE_URL + DIRECT_URL set (even dummies are rejected if invalid). */
import "./load-env.mjs";
import { spawnSync } from "node:child_process";
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

const result = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  env: process.env,
  shell: true
});

process.exit(result.status ?? 1);
