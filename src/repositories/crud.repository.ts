import type { Model } from "mongoose";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";

type ListParams = {
  page: number;
  limit: number;
  query?: string | null;
  status?: string | null;
  sort?: string;
  searchFields?: string[];
  extraMatch?: Record<string, unknown>;
};

function assertValidId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    return false;
  }
  return true;
}

export async function listDocuments(
  model: Model<any>,
  params: ListParams,
  populate?: string | string[]
) {
  await connectDb();
  const match: Record<string, unknown> = { ...(params.extraMatch ?? {}) };
  if (params.status) match.status = params.status;
  if (params.query && params.searchFields?.length) {
    match.$or = params.searchFields.map((field) => ({
      [field]: { $regex: params.query, $options: "i" }
    }));
  }

  const sortField: Record<string, 1 | -1> =
    params.sort === "name" || params.sort === "title" || params.sort === "fullName"
      ? { [params.sort]: 1 }
      : { createdAt: -1 };

  let query = model
    .find(match)
    .sort(sortField)
    .skip((params.page - 1) * params.limit)
    .limit(params.limit);

  if (populate) {
    const fields = Array.isArray(populate) ? populate : [populate];
    for (const field of fields) query = query.populate(field);
  }

  const [data, total] = await Promise.all([query.lean(), model.countDocuments(match)]);
  return { data, total };
}

export async function createDocument(model: Model<any>, payload: Record<string, unknown>) {
  await connectDb();
  return model.create(payload as any);
}

export async function updateDocument(model: Model<any>, id: string, payload: Record<string, unknown>) {
  await connectDb();
  if (!assertValidId(id)) return null;
  return model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

/** Permanently removes one document from MongoDB. Returns the deleted doc or null. */
export async function removeDocument(model: Model<any>, id: string) {
  await connectDb();
  if (!assertValidId(id)) return null;

  const deleted = await model.findByIdAndDelete(id);
  if (!deleted) return null;

  // Verify it is gone
  const stillThere = await model.exists({ _id: id });
  if (stillThere) {
    throw new Error("Delete verification failed — record still exists in MongoDB");
  }

  return deleted;
}

/** Permanently removes many documents from MongoDB. */
export async function removeManyDocuments(model: Model<any>, ids: string[]) {
  await connectDb();
  const validIds = ids.filter((id) => assertValidId(id));
  if (validIds.length === 0) {
    return { deletedCount: 0, acknowledged: true };
  }

  const result = await model.deleteMany({ _id: { $in: validIds } });

  const remaining = await model.countDocuments({ _id: { $in: validIds } });
  if (remaining > 0) {
    throw new Error(`Delete verification failed — ${remaining} record(s) still exist in MongoDB`);
  }

  return result;
}

export async function duplicateDocument(
  model: Model<any>,
  id: string,
  overrides: Record<string, unknown> = {}
) {
  await connectDb();
  if (!assertValidId(id)) return null;
  const existing = await model.findById(id).lean();
  if (!existing || Array.isArray(existing)) return null;
  const copy = { ...(existing as Record<string, unknown>) };
  delete copy._id;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.__v;
  delete copy.isArchived;
  return model.create({ ...copy, ...overrides, isArchived: false } as any);
}

/**
 * Permanently purge soft-archived records so they cannot reappear as "ghost" data.
 * Call once per list request for models that historically used isArchived.
 */
export async function purgeArchivedDocuments(model: Model<any>) {
  if (!("isArchived" in (model.schema.paths ?? {}))) return 0;
  await connectDb();
  const result = await model.deleteMany({ isArchived: true });
  return result.deletedCount ?? 0;
}
