import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";

const SALT_ROUNDS = 12;

/** Standard bcrypt hash: $2a$ / $2b$ / $2y$ + cost + 22-char salt + 31-char hash */
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptHash(value: string | null | undefined): boolean {
  return typeof value === "string" && BCRYPT_HASH_RE.test(value);
}

export async function hashPassword(password: string) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 * Returns false for missing/corrupt hashes instead of throwing.
 */
export async function comparePassword(password: string, passwordHash: string) {
  if (typeof password !== "string" || typeof passwordHash !== "string" || !passwordHash) {
    return false;
  }
  if (!isBcryptHash(passwordHash)) {
    logger.warn("Invalid password hash format in database", {
      hashPrefix: passwordHash.slice(0, 7),
      hashLength: passwordHash.length
    });
    return false;
  }
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch (error) {
    logger.error("bcrypt.compare failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Verifies password, also accepting accidental leading/trailing whitespace
 * when the trimmed value matches the stored hash.
 */
export async function verifyPassword(password: string, passwordHash: string) {
  if (await comparePassword(password, passwordHash)) return true;
  const trimmed = password.trim();
  if (trimmed !== password && trimmed.length >= 8) {
    return comparePassword(trimmed, passwordHash);
  }
  return false;
}
