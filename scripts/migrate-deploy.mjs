#!/usr/bin/env node
/** @deprecated Use db-bootstrap.mjs — kept as alias for db:migrate */
import { spawnSync } from "node:child_process";

const result = spawnSync("node", ["scripts/db-bootstrap.mjs"], {
  stdio: "inherit",
  env: process.env,
  shell: true
});

process.exit(result.status ?? 1);
