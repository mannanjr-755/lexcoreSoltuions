import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hasDatabaseUrl = Boolean(
      process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
    );

    // Lazy import so missing env fails with our clearer Prisma helper message
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      postgresql: "connected",
      databaseUrlConfigured: hasDatabaseUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const hasDatabaseUrl = Boolean(
      process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
    );
    if (!hasDatabaseUrl) {
      return NextResponse.json(
        {
          status: "error",
          postgresql: "disconnected",
          databaseUrlConfigured: false,
          message:
            "DATABASE_URL is not visible to this Netlify function. Set it under Site settings → Environment variables for Builds and Runtime (no quotes)."
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
