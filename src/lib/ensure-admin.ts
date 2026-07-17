import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/bcrypt";
import { getSystemSettings } from "@/services/settings.service";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

function isMissingUsersTable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("public.users") && message.includes("does not exist");
}

/**
 * Ensures exactly one Super Admin exists.
 * Creates from SUPER_ADMIN_* env vars when missing.
 */
export async function ensureSuperAdmin() {
  let existing;
  try {
    existing = await prisma.user.findFirst({ where: { role: "super_admin" } });
  } catch (error) {
    if (isMissingUsersTable(error)) {
      throw new Error(
        "Database tables are missing. Run `npm run db:setup` (or redeploy on Netlify so the build applies migrations and seed)."
      );
    }
    throw error;
  }
  if (existing) return existing;

  const env = getEnv();
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) {
    throw new Error(
      "Super Admin does not exist. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env.local, then try again."
    );
  }

  const passwordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD);
  const admin = await prisma.user.create({
    data: {
      fullName: env.SUPER_ADMIN_NAME ?? "Super Admin",
      email: env.SUPER_ADMIN_EMAIL.toLowerCase().trim(),
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
  logger.info("Super Admin auto-created from environment", { email: admin.email });
  return admin;
}
