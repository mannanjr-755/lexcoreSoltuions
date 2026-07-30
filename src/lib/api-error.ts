import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { DatabaseNotReadyError } from "@/lib/ensure-database";
import { isTransientDbError } from "@/lib/db-retry";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function logDbError(context: string, error: unknown) {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(context, { code, message, stack });
}

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
      const fields = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).map(String)
        : [String(error.meta?.target ?? "record")];
      const joined = fields.join(", ");
      logDbError("Unique constraint violation", error);
      if (fields.some((field) => field.toLowerCase().includes("customerid"))) {
        return NextResponse.json(
          { message: "Could not allocate a unique customer ID. Please try again." },
          { status: 409 }
        );
      }
      if (fields.some((field) => field.toLowerCase().includes("phone"))) {
        return NextResponse.json(
          { message: "A customer with this phone number already exists." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: `Duplicate entry. A record with the same ${joined} already exists.` },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }
    if (error.code === "P2021") {
      const table = String((error.meta as { table?: string } | undefined)?.table ?? "unknown");
      logDbError("Table does not exist in database", error);
      return NextResponse.json(
        {
          message: `Database schema is missing (table: ${table}). Set NETLIFY_RUN_MIGRATIONS=true and redeploy, or POST /api/setup/seed.`
        },
        { status: 503 }
      );
    }
    if (error.code === "P1001" || error.code === "P1000" || error.code === "P1017") {
      logDbError("Database connection error", error);
      return NextResponse.json(
        { message: "Unable to reach the database. Please try again in a moment." },
        { status: 503 }
      );
    }
    if (error.code === "P2024") {
      logDbError("Database connection pool timeout", error);
      return NextResponse.json(
        {
          message:
            "The database is temporarily overloaded. Please wait a second and try again."
        },
        { status: 503 }
      );
    }
    if (error.code === "P2003") {
      logDbError("Foreign key constraint failed", error);
      return NextResponse.json({ message: "Related record not found (invalid reference)." }, { status: 400 });
    }
    if (error.code === "P2011") {
      const fields = Array.isArray(error.meta?.constraint)
        ? (error.meta?.constraint as string[]).join(", ")
        : "required field";
      logDbError("Null constraint violation", error);
      return NextResponse.json(
        { message: `Missing required field: ${fields}. Please complete the form and try again.` },
        { status: 400 }
      );
    }
    if (error.code === "P2022") {
      const column = String((error.meta as { column?: string } | undefined)?.column ?? "unknown");
      logDbError("Column does not exist in database", error);
      return NextResponse.json(
        {
          message: `Database schema is out of date (missing column: ${column}). Run migrations or redeploy with NETLIFY_RUN_MIGRATIONS=true.`
        },
        { status: 503 }
      );
    }
    if (error.code === "P2000") {
      logDbError("Value too long for column", error);
      return NextResponse.json(
        { message: "One of the values is too long for the database field." },
        { status: 400 }
      );
    }
    logDbError("Prisma known request error", error);
    const code = error.code;
    const column =
      typeof error.meta === "object" && error.meta && "column" in error.meta
        ? String((error.meta as { column?: string }).column)
        : undefined;
    const table =
      typeof error.meta === "object" && error.meta && "table" in error.meta
        ? String((error.meta as { table?: string }).table)
        : undefined;
    const detail = [code, table && `table=${table}`, column && `column=${column}`]
      .filter(Boolean)
      .join(" · ");
    return NextResponse.json(
      {
        message: `Database request failed${detail ? ` (${detail})` : ""}. Please try again or contact support.`
      },
      { status: 500 }
    );
  }

  if (error instanceof Error) {
    if (error instanceof HttpError) {
      if (error.status >= 500) {
        logger.error(error.message, { status: error.status, ...error.details });
      } else {
        logger.warn(error.message, { status: error.status, ...error.details });
      }
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
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
    if (isTransientDbError(error)) {
      logDbError("Transient database error after retries", error);
      return NextResponse.json(
        {
          message:
            "The database is temporarily overloaded. Please wait a second and try again."
        },
        { status: 503 }
      );
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

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}
