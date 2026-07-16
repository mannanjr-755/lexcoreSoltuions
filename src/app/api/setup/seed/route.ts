import { NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/ensure-admin";
import { handleApiError } from "@/lib/api-error";

export async function POST() {
  try {
    const admin = await ensureSuperAdmin();
    return NextResponse.json({
      message: "Super Admin is ready",
      email: admin.email,
      note: "Use SUPER_ADMIN_PASSWORD from .env.local to sign in"
    });
  } catch (error) {
    return handleApiError(error);
  }
}
