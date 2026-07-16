/** Map Prisma `id` → `_id` so existing frontend code keeps working. */
export function withMongoId<T extends { id: string }>(
  doc: T | null | undefined
): (Omit<T, "id"> & { _id: string; id: string }) | null {
  if (!doc) return null;
  const { id, ...rest } = doc;
  return { ...(rest as Omit<T, "id">), _id: id, id };
}

export function withMongoIds<T extends { id: string }>(docs: T[]) {
  return docs.map((d) => withMongoId(d)!);
}

export function serializeNested<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => serializeNested(item)) as T;
  }
  if (typeof value === "object" && value instanceof Date) return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "id" && typeof val === "string") {
        out.id = val;
        out._id = val;
      } else if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
        out[key] = serializeNested(val);
      } else if (Array.isArray(val)) {
        out[key] = val.map((v) => (v && typeof v === "object" ? serializeNested(v) : v));
      } else {
        out[key] = val;
      }
    }
    return out as T;
  }
  return value;
}
