import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hasDatabaseUrl = Boolean(
      process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
    );

    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    const names = tables.map((t) => t.tablename);
    const usersExists = names.includes("users");

    return NextResponse.json({
      status: usersExists ? "ok" : "schema_missing",
      postgresql: "connected",
      databaseUrlConfigured: hasDatabaseUrl,
      usersTableExists: usersExists,
      tableCount: names.length,
      tables: names,
      hint: usersExists
        ? undefined
        : "Redeploy so Netlify runs db-bootstrap (migrate + verify + seed), or POST /api/setup/seed after fixing DATABASE_URL",
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
