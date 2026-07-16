import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const healthy = true;
    return NextResponse.json({
      status: healthy ? "ok" : "degraded",
      postgresql: healthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
