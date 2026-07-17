import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { DatabaseNotReadyError } from "@/lib/ensure-database";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const detail = first ? `${first.path.join(".")}: ${first.message}` : "Invalid request data";
    logger.warn("Zod validation error", { detail, issues: error.issues });
    return NextResponse.json({ message: detail, errors: error.flatten() }, { status: 400 });
  }

  if (error instanceof DatabaseNotReadyError) {
    logger.error(error.message);
    return NextResponse.json({ message: error.message }, { status: 503 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]).join(", ") : "record";
      return NextResponse.json(
        { message: `Duplicate entry. A record with the same ${fields} already exists.` },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }
    if (error.code === "P2021") {
      return NextResponse.json(
        {
          message:
            "Database schema is missing (public.users not found). Set NETLIFY_RUN_MIGRATIONS=true and redeploy, or POST /api/setup/seed."
        },
        { status: 503 }
      );
    }
    if (error.code === "P1001" || error.code === "P1000" || error.code === "P1017") {
      logger.error("Database connection error", { code: error.code, message: error.message });
      return NextResponse.json(
        { message: "Database connection failed. Verify DATABASE_URL in Netlify Runtime environment variables." },
        { status: 503 }
      );
    }
    if (error.code === "P2003") {
      return NextResponse.json({ message: "Related record not found (invalid reference)." }, { status: 400 });
    }
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (
      error.message.startsWith("Invalid environment configuration") ||
      error.message.startsWith("JWT_ACCESS_SECRET") ||
      error.message.startsWith("JWT_REFRESH_SECRET") ||
      error.message.startsWith("DATABASE_URL is missing")
    ) {
      logger.error(error.message);
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    if (error.message.includes("SMTP")) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    logger.error(error.message, { stack: error.stack });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  logger.error("Unknown server error", { error: String(error) });
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}
