/**
 * Load .env.local then .env for Prisma CLI scripts (Node does not load these automatically).
 * On Netlify, only platform env vars are used (.env files are not committed).
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const isNetlify = process.env.NETLIFY === "true";

if (!isNetlify && existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local") });
}
if (!isNetlify && existsSync(resolve(root, ".env"))) {
  config({ path: resolve(root, ".env") });
}
