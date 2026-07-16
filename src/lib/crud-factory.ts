import { NextResponse } from "next/server";
import type { Model } from "mongoose";
import type { z } from "zod";
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
  updateDocument
} from "@/repositories/crud.repository";

type CrudConfig = {
  model: Model<any>;
  entity: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodTypeAny & { partial?: () => z.ZodTypeAny };
  searchFields: string[];
  populate?: string | string[];
  transformCreate?: (data: Record<string, unknown>, sessionId: string) => Record<string, unknown>;
  transformUpdate?: (data: Record<string, unknown>) => Record<string, unknown>;
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

      // Remove legacy soft-deleted rows permanently so they never linger in MongoDB
      await purgeArchivedDocuments(config.model);

      const params = parseListParams(req);
      const extraMatch: Record<string, unknown> = {};
      // Archived filter kept only for backward compat; archived docs are purged above
      if (params.archived === "1") {
        return NextResponse.json({ data: [], total: 0 });
      }

      const result = await listDocuments(
        config.model,
        {
          ...params,
          searchFields: config.searchFields,
          extraMatch
        },
        config.populate
      );

      return NextResponse.json(result);
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
        const duplicated = await duplicateDocument(config.model, body.id, body.overrides ?? {});
        if (!duplicated) return NextResponse.json({ message: "Record not found" }, { status: 404 });
        return NextResponse.json(duplicated, { status: 201 });
      }

      if (body?.action === "bulkUpdate" && Array.isArray(body.ids)) {
        await config.model.updateMany({ _id: { $in: body.ids } }, body.data ?? {});
        return NextResponse.json({ message: "Updated", count: body.ids.length });
      }

      const parsed = config.schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
      }

      let payload = parsed.data as Record<string, unknown>;
      if (config.transformCreate) payload = config.transformCreate(payload, session.id);
      // Never create as archived
      if ("isArchived" in payload) payload.isArchived = false;
      const created = await createDocument(config.model, payload);

      const { ipAddress, userAgent, browser } = getClientInfo(req);
      await logActivity({
        userId: session.id,
        userName: session.fullName,
        action: `${config.entity}_created`,
        entity: config.entity,
        entityId: String((created as { _id: unknown })._id),
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

      const result = await removeManyDocuments(config.model, ids);

      const { ipAddress, userAgent, browser } = getClientInfo(req);
      await logActivity({
        userId: session.id,
        userName: session.fullName,
        action: `${config.entity}_bulk_deleted`,
        entity: config.entity,
        description: `Permanently deleted ${result.deletedCount ?? ids.length} ${config.entity}(s) from MongoDB`,
        ipAddress,
        userAgent,
        browser
      });

      return NextResponse.json({
        message: "Records permanently deleted",
        deletedCount: result.deletedCount ?? 0
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
      await connectSafe();
      let q = config.model.findById(id);
      if (config.populate) {
        const fields = Array.isArray(config.populate) ? config.populate : [config.populate];
        for (const field of fields) q = q.populate(field);
      }
      const doc = await q.lean();
      if (!doc) return NextResponse.json({ message: "Record not found" }, { status: 404 });
      return NextResponse.json(doc);
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

      // Legacy archive/restore actions now permanently delete (no soft-hide)
      if (body?.action === "archive") {
        const deleted = await removeDocument(config.model, id);
        if (!deleted) return NextResponse.json({ message: "Record not found" }, { status: 404 });
        return NextResponse.json({ message: "Record permanently deleted", deleted: true });
      }
      if (body?.action === "restore") {
        return NextResponse.json(
          { message: "Restore is unavailable. Soft-delete has been removed; use Create to add records." },
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
      // Prevent soft-hide via updates
      if ("isArchived" in payload) delete payload.isArchived;

      const updated = await updateDocument(config.model, id, payload);
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

      const deleted = await removeDocument(config.model, id);
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
        description: `${config.entity} permanently deleted from MongoDB`,
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

async function connectSafe() {
  const { connectDb } = await import("@/lib/db");
  await connectDb();
}
