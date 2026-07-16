import { connectDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/bcrypt";
import { UserModel } from "@/models/User";
import { getSystemSettings } from "@/models/SystemSettings";
import { logger } from "@/lib/logger";

/**
 * Ensures exactly one Super Admin exists.
 * Creates from SUPER_ADMIN_* env vars when missing.
 */
export async function ensureSuperAdmin() {
  await connectDb();

  const existing = await UserModel.findOne({ role: "super_admin" });
  if (existing) return existing;

  const env = getEnv();
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) {
    throw new Error(
      "Super Admin does not exist. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env.local, then try again."
    );
  }

  const passwordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD);
  const admin = await UserModel.create({
    fullName: env.SUPER_ADMIN_NAME ?? "Super Admin",
    email: env.SUPER_ADMIN_EMAIL.toLowerCase().trim(),
    passwordHash,
    role: "super_admin",
    company: "Lexcore Solutions",
    designation: "Super Admin",
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null
  });

  await getSystemSettings();
  logger.info("Super Admin auto-created from environment", { email: admin.email });
  return admin;
}
