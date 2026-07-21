import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hasDatabaseUrl = Boolean(
      process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
    );

    const user = await prisma.user.findFirst({
      select: { id: true },
      where: { role: "super_admin" }
    });

    return NextResponse.json({
      status: user ? "ok" : "schema_missing",
      postgresql: "connected",
      databaseUrlConfigured: hasDatabaseUrl,
      usersTableExists: Boolean(user),
      superAdminExists: Boolean(user),
      hint: user
        ? undefined
        : "Run NETLIFY_RUN_MIGRATIONS=true on deploy, or POST /api/setup/seed",
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
