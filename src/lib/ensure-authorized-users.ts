import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword, isBcryptHash } from "@/lib/bcrypt";
import {
  AUTHORIZED_USERS,
  getAuthorizedUserPassword,
  getMigratablePasswordsForUser,
  type AuthorizedUser
} from "@/lib/authorized-users";
import { logger } from "@/lib/logger";

type EnsureOptions = {
  /** When true, overwrite password hashes with seed/env passwords. */
  syncPasswords?: boolean;
};

let ensurePromise: Promise<void> | null = null;
let ensureCompletedAt = 0;
const ENSURE_TTL_MS = 5 * 60 * 1000;

async function hashMatchesAny(passwordHash: string, candidates: string[]): Promise<boolean> {
  for (const candidate of candidates) {
    if (await comparePassword(candidate, passwordHash)) return true;
  }
  return false;
}

async function shouldResetPassword(
  member: AuthorizedUser,
  passwordHash: string,
  forceSync: boolean
): Promise<boolean> {
  if (forceSync) return true;
  if (!isBcryptHash(passwordHash)) return true;

  const configured = getAuthorizedUserPassword(member);
  if (await comparePassword(configured, passwordHash)) return false;

  // Hash does not match the configured password. Reset only when it still
  // matches a known legacy/seed password (not a user-chosen password).
  const migratable = getMigratablePasswordsForUser(member).filter((p) => p !== configured);
  return hashMatchesAny(passwordHash, migratable);
}

async function ensureAuthorizedUsersOnce(options: EnsureOptions = {}) {
  const forceSync =
    options.syncPasswords === true || process.env.AUTHORIZED_USERS_SYNC_PASSWORDS === "true";

  for (const member of AUTHORIZED_USERS) {
    const configuredPassword = getAuthorizedUserPassword(member);
    const existing = await prisma.user.findUnique({
      where: { email: member.email },
      select: { id: true, passwordHash: true }
    });

    if (!existing) {
      const passwordHash = await hashPassword(configuredPassword);
      await prisma.user.create({
        data: {
          fullName: member.name,
          email: member.email,
          passwordHash,
          role: "super_admin",
          company: "Lexcore Solutions",
          designation: member.roleTitle,
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      logger.info("Authorized user created", { email: member.email });
      continue;
    }

    const resetPassword = await shouldResetPassword(member, existing.passwordHash, forceSync);
    const passwordHash = resetPassword ? await hashPassword(configuredPassword) : undefined;

    await prisma.user.update({
      where: { email: member.email },
      data: {
        fullName: member.name,
        role: "super_admin",
        isActive: true,
        company: "Lexcore Solutions",
        designation: member.roleTitle,
        ...(passwordHash ? { passwordHash, failedLoginAttempts: 0, lockedUntil: null } : {})
      }
    });

    if (passwordHash) {
      logger.info("Authorized user password hash repaired/migrated", {
        email: member.email,
        forceSync,
        corruptHash: !isBcryptHash(existing.passwordHash)
      });
    }
  }
}

/**
 * Ensures the five authorized company accounts exist with correct bcrypt hashes.
 * Each user gets their own password (env override or unique default).
 * Migrates legacy shared passwords and repairs corrupt hashes.
 * Does NOT overwrite passwords users have changed via Change Password.
 * Cached briefly so login is not slowed by repeated bcrypt scans.
 */
export async function ensureAuthorizedUsers(options: EnsureOptions = {}) {
  const forceSync =
    options.syncPasswords === true || process.env.AUTHORIZED_USERS_SYNC_PASSWORDS === "true";
  const cacheFresh = Date.now() - ensureCompletedAt < ENSURE_TTL_MS;

  if (!forceSync && cacheFresh) {
    return;
  }

  if (!ensurePromise) {
    ensurePromise = ensureAuthorizedUsersOnce(options)
      .then(() => {
        ensureCompletedAt = Date.now();
      })
      .finally(() => {
        ensurePromise = null;
      });
  }

  await ensurePromise;
}

/**
 * If the submitted password matches the configured seed/env password for an
 * authorized user but the stored hash does not verify, rewrite the hash.
 * Used during login to heal DB/seed drift without accepting wrong passwords.
 */
export async function repairAuthorizedPasswordHash(email: string, plaintextPassword: string) {
  const member = AUTHORIZED_USERS.find((user) => user.email === email);
  if (!member) return false;

  const configured = getAuthorizedUserPassword(member);
  const submitted = plaintextPassword.trim();
  if (plaintextPassword !== configured && submitted !== configured) {
    return false;
  }

  const passwordHash = await hashPassword(configured);
  await prisma.user.update({
    where: { email: member.email },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null
    }
  });
  logger.warn("Repaired out-of-sync password hash on successful credential match", {
    email: member.email
  });
  return true;
}
