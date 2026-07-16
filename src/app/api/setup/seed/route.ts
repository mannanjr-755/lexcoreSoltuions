import { NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/ensure-admin";
import { ensureStaffEmployees } from "@/lib/ensure-staff";
import { getSystemSettings } from "@/services/settings.service";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function POST() {
  try {
    const [admin] = await Promise.all([ensureSuperAdmin(), ensureStaffEmployees(), getSystemSettings()]);
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
      note: "Use SUPER_ADMIN_PASSWORD from .env.local to sign in"
    });
  } catch (error) {
    return handleApiError(error);
  }
}
