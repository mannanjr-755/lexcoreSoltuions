import { NextResponse } from "next/server";
import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getSession } from "@/lib/auth";
import { getClientInfo, logActivity } from "@/lib/activity";
import {
  createDocument,
  duplicateDocument,
  listDocuments,
  purgeArchivedDocuments,
  removeDocument,
  removeManyDocuments,
  updateDocument,
  type Delegate
} from "@/repositories/crud.repository";

type CrudConfig = {
  entity: string;
  delegate: Delegate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodTypeAny & { partial?: () => z.ZodTypeAny };
  searchFields: string[];
  include?: Record<string, unknown>;
  hasArchived?: boolean;
  transformCreate?: (data: Record<string, unknown>, sessionId: string) => Record<string, unknown>;
  transformUpdate?: (data: Record<string, unknown>) => Record<string, unknown>;
  mapRow?: (row: Record<string, unknown>) => Record<string, unknown>;
};

function parseListParams(req: Request) {
  const { searchParams } = new URL(req.url);
  return {
    page: Math.max(Number(searchParams.get("page") ?? "1"), 1),
    limit: Math.max(1, Math.min(Number(searchParams.get("limit") ?? "10"), 100)),
    query: searchParams.get("query"),
    status: searchParams.get("status"),
    sort: searchParams.get("sort") ?? "createdAt",
    archived: searchParams.get("archived")
  };
}

export function createCrudHandlers(config: CrudConfig) {
  async function GET(req: Request) {
    try {
      const session = await getSession();
      if (!session) return unauthorized();

      if (config.hasArchived !== false) {
        await purgeArchivedDocuments(config.delegate);
      }

      const params = parseListParams(req);
      if (params.archived === "1") {
        return NextResponse.json({ data: [], total: 0 });
      }

      const result = await listDocuments(config.delegate, {
        ...params,
        searchFields: config.searchFields,
        include: config.include
      });

      return NextResponse.json({
        ...result,
        data: config.mapRow ? result.data.map((row) => config.mapRow!(row)) : result.data
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async function POST(req: Request) {
    try {
      const session = await getSession();
      if (!session) return unauthorized();
      const body = await req.json();

      if (body?.action === "duplicate" && typeof body.id === "string") {
        const duplicated = await duplicateDocument(config.delegate, body.id, body.overrides ?? {});
        if (!duplicated) return NextResponse.json({ message: "Record not found" }, { status: 404 });
        return NextResponse.json(duplicated, { status: 201 });
      }

      if (body?.action === "bulkUpdate" && Array.isArray(body.ids) && config.delegate.updateMany) {
        await config.delegate.updateMany({
          where: { id: { in: body.ids } },
          data: body.data ?? {}
        });
        return NextResponse.json({ message: "Updated", count: body.ids.length });
      }

      const parsed = config.schema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return NextResponse.json(
          {
            message: first ? `${first.path.join(".") || "field"}: ${first.message}` : "Validation failed",
            errors: parsed.error.flatten()
          },
          { status: 400 }
        );
      }

      let payload = parsed.data as Record<string, unknown>;
      if (config.transformCreate) payload = config.transformCreate(payload, session.id);
      if ("isArchived" in payload) payload.isArchived = false;

      const created = await createDocument(config.delegate, payload);

      const { ipAddress, userAgent, browser } = getClientInfo(req);
      await logActivity({
        userId: session.id,
        userName: session.fullName,
        action: `${config.entity}_created`,
        entity: config.entity,
        entityId: String((created as { _id?: string; id?: string })?._id ?? (created as { id?: string })?.id),
        description: `${config.entity} created`,
        ipAddress,
        userAgent,
        browser
      });

      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async function DELETE(req: Request) {
    try {
      const session = await getSession();
      if (!session) return unauthorized();
      const body = await req.json();
      const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
      if (ids.length === 0) {
        return NextResponse.json({ message: "No IDs provided" }, { status: 400 });
      }

      const result = await removeManyDocuments(config.delegate, ids);

      const { ipAddress, userAgent, browser } = getClientInfo(req);
      await logActivity({
        userId: session.id,
        userName: session.fullName,
        action: `${config.entity}_bulk_deleted`,
        entity: config.entity,
        description: `Permanently deleted ${result.count} ${config.entity}(s) from PostgreSQL`,
        ipAddress,
        userAgent,
        browser
      });

      return NextResponse.json({
        message: "Records permanently deleted",
        deletedCount: result.count
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async function GET_ONE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
      const session = await getSession();
      if (!session) return unauthorized();
      const { id } = await ctx.params;
      const doc = await config.delegate.findUnique({
        where: { id },
        include: config.include
      });
      if (!doc) return NextResponse.json({ message: "Record not found" }, { status: 404 });
      const { withMongoId, serializeNested } = await import("@/lib/serialize");
      const serialized = withMongoId(serializeNested(doc));
      return NextResponse.json(config.mapRow ? config.mapRow(serialized as Record<string, unknown>) : serialized);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
      const session = await getSession();
      if (!session) return unauthorized();
      const { id } = await ctx.params;
      const body = await req.json();

      if (body?.action === "archive") {
        const deleted = await removeDocument(config.delegate, id);
        if (!deleted) return NextResponse.json({ message: "Record not found" }, { status: 404 });
        return NextResponse.json({ message: "Record permanently deleted", deleted: true });
      }
      if (body?.action === "restore") {
        return NextResponse.json(
          { message: "Restore is unavailable. Soft-delete has been removed." },
          { status: 400 }
        );
      }

      const partialSchema =
        typeof (config.schema as { partial?: () => z.ZodTypeAny }).partial === "function"
          ? (config.schema as { partial: () => z.ZodTypeAny }).partial()
          : config.schema;
      const parsed = partialSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
      }

      let payload = parsed.data as Record<string, unknown>;
      if (config.transformUpdate) payload = config.transformUpdate(payload);
      if ("isArchived" in payload) delete payload.isArchived;

      const updated = await updateDocument(config.delegate, id, payload);
      if (!updated) return NextResponse.json({ message: "Record not found" }, { status: 404 });
      return NextResponse.json(updated);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async function DELETE_ONE(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
      const session = await getSession();
      if (!session) return unauthorized();
      const { id } = await ctx.params;

      const deleted = await removeDocument(config.delegate, id);
      if (!deleted) {
        return NextResponse.json({ message: "Record not found" }, { status: 404 });
      }

      const { ipAddress, userAgent, browser } = getClientInfo(req);
      await logActivity({
        userId: session.id,
        userName: session.fullName,
        action: `${config.entity}_deleted`,
        entity: config.entity,
        entityId: id,
        description: `${config.entity} permanently deleted from PostgreSQL`,
        ipAddress,
        userAgent,
        browser
      });

      return NextResponse.json({
        message: "Record permanently deleted",
        deleted: true,
        id
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  return { GET, POST, DELETE, GET_ONE, PATCH, DELETE_ONE };
}

export function isPrismaUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
