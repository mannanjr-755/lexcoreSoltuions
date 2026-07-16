import { NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/ensure-admin";
import { ensureStaffEmployees } from "@/lib/ensure-staff";
import { getSystemSettings } from "@/services/settings.service";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/setup/seed
 * Ensures Super Admin + staff + departments + settings exist.
 * Call once after first successful migrate deploy.
 */
export async function POST() {
  try {
    // Verify schema is applied
    await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;

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
            "Database tables are missing. Redeploy so Netlify runs `prisma migrate deploy` (included in npm run build), then call /api/setup/seed again."
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    const userCount = tables.some((t) => t.tablename === "users")
      ? await prisma.user.count()
      : -1;

    return NextResponse.json({
      tables: tables.map((t) => t.tablename),
      usersTableExists: tables.some((t) => t.tablename === "users"),
      userCount
    });
  } catch (error) {
    return handleApiError(error);
  }
}
