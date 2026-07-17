/* eslint-disable @typescript-eslint/no-explicit-any -- generic Prisma delegate wrapper */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeNested, withMongoId, withMongoIds } from "@/lib/serialize";

type PrismaModelName = {
  [K in keyof PrismaClient]: PrismaClient[K] extends { findMany: (...args: any[]) => any } ? K : never;
}[keyof PrismaClient];

export type Delegate = {
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any>;
  findFirst: (args?: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args?: any) => Promise<{ count: number }>;
  count: (args?: any) => Promise<number>;
  updateMany?: (args: any) => Promise<{ count: number }>;
};

type ListParams = {
  page: number;
  limit: number;
  query?: string | null;
  status?: string | null;
  sort?: string;
  searchFields?: string[];
  extraWhere?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

function buildSearchWhere(query: string | null | undefined, searchFields: string[] = []) {
  if (!query?.trim() || searchFields.length === 0) return {};
  return {
    OR: searchFields.map((field) => ({
      [field]: { contains: query.trim(), mode: "insensitive" as const }
    }))
  };
}

export async function listDocuments(delegate: Delegate, params: ListParams) {
  const where: Record<string, unknown> = { ...(params.extraWhere ?? {}) };
  if (params.status) where.status = params.status;
  Object.assign(where, buildSearchWhere(params.query, params.searchFields));

  const orderBy =
    params.sort === "name" || params.sort === "title" || params.sort === "fullName"
      ? { [params.sort]: "asc" as const }
      : { createdAt: "desc" as const };

  const [data, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: params.include
    }),
    delegate.count({ where })
  ]);

  return { data: withMongoIds(serializeNested(data)), total };
}

export async function createDocument(delegate: Delegate, payload: Record<string, unknown>) {
  const created = await delegate.create({ data: payload });
  return withMongoId(serializeNested(created));
}

export async function updateDocument(delegate: Delegate, id: string, payload: Record<string, unknown>) {
  try {
    const updated = await delegate.update({ where: { id }, data: payload });
    return withMongoId(serializeNested(updated));
  } catch {
    return null;
  }
}

export async function removeDocument(delegate: Delegate, id: string) {
  try {
    const deleted = await delegate.delete({ where: { id } });
    const stillThere = await delegate.findUnique({ where: { id } });
    if (stillThere) {
      throw new Error("Delete verification failed — record still exists in PostgreSQL");
    }
    return withMongoId(serializeNested(deleted));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Delete verification")) throw error;
    return null;
  }
}

export async function removeManyDocuments(delegate: Delegate, ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  const result = await delegate.deleteMany({ where: { id: { in: ids } } });
  const remaining = await delegate.count({ where: { id: { in: ids } } });
  if (remaining > 0) {
    throw new Error(`Delete verification failed — ${remaining} record(s) still exist`);
  }
  return result;
}

export async function duplicateDocument(
  delegate: Delegate,
  id: string,
  overrides: Record<string, unknown> = {}
) {
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) return null;
  const copy = { ...existing } as Record<string, unknown>;
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.isArchived;
  const created = await delegate.create({ data: { ...copy, ...overrides, isArchived: false } });
  return withMongoId(serializeNested(created));
}

export async function purgeArchivedDocuments(delegate: Delegate) {
  try {
    const result = await delegate.deleteMany({ where: { isArchived: true } });
    return result.count;
  } catch {
    return 0;
  }
}

export function getDelegate(model: PrismaModelName): Delegate {
  return prisma[model] as unknown as Delegate;
}
