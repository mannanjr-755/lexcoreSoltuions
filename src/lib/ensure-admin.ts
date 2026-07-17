import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/bcrypt";
import { getSystemSettings } from "@/services/settings.service";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { ensureDatabaseSchema } from "@/lib/ensure-database";
import { getSuperAdminConfig } from "@/lib/database-url";

function isMissingUsersTable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("public.users") && message.includes("does not exist");
}

/**
 * Ensures exactly one Super Admin exists.
 * Creates from SUPER_ADMIN_* env vars (defaults: admin@lexcore.com / Lexcore@2026!).
 */
export async function ensureSuperAdmin() {
  await ensureDatabaseSchema();

  let existing;
  try {
    existing = await prisma.user.findFirst({ where: { role: "super_admin" } });
  } catch (error) {
    if (isMissingUsersTable(error)) {
      throw new Error(
        "Database tables are missing. Set NETLIFY_RUN_MIGRATIONS=true and redeploy, or POST /api/setup/seed."
      );
    }
    throw error;
  }
  if (existing) return existing;

  const { email, password, name } = getSuperAdminConfig();
  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      fullName: name,
      email,
      passwordHash,
      role: "super_admin",
      company: "Lexcore Solutions",
      designation: "Super Admin",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null
    }
  });

  await getSystemSettings();
  logger.info("Super Admin auto-created", { email: admin.email });
  return admin;
}
