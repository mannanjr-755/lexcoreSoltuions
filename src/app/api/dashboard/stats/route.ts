import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getDashboardStats } from "@/services/dashboard.service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const stats = await getDashboardStats(session.id);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
