import { NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/ensure-admin";
import { ensureStaffEmployees } from "@/lib/ensure-staff";
import { getSystemSettings } from "@/services/settings.service";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { ensureDatabaseSchema } from "@/lib/ensure-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/setup/seed
 * Ensures Super Admin + staff + departments + settings exist.
 * Call once after first successful migrate deploy.
 */
export async function POST() {
  try {
    await ensureDatabaseSchema();

    const admin = await ensureSuperAdmin();
    await ensureStaffEmployees();
    await getSystemSettings();

    for (const department of [
      { name: "Engineering", code: "ENG", description: "Product & software delivery", managerName: "Abdul-Mannan" },
      { name: "Operations", code: "OPS", description: "Project coordination & delivery ops", managerName: "Muhammad-Yousuf" },
      { name: "HR", code: "HR", description: "People & culture", managerName: "Anjasha" },
      { name: "General", code: "GEN", description: "General administration", managerName: "" }
    ]) {
      await prisma.department.upsert({
        where: { name: department.name },
        update: department,
        create: { ...department, status: "active" }
      });
    }

    return NextResponse.json({
      message: "PostgreSQL seed data is ready",
      email: admin.email,
      loginHint: "Sign in with SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from Netlify env (default admin@lexcore.com)"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist") || message.includes("users")) {
      return NextResponse.json(
        {
          message:
            "Database tables are missing. Redeploy so Netlify runs db-bootstrap (migrate + verify + seed in npm run build), then call /api/setup/seed again."
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const usersTableExists = userCount >= 0;

    return NextResponse.json({
      usersTableExists,
      userCount
    });
  } catch (error) {
    return handleApiError(error);
  }
}
