import { prisma } from "@/lib/prisma";
import { withMongoId, serializeNested } from "@/lib/serialize";

export async function getSystemSettings() {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} });
  }
  return withMongoId(serializeNested(settings))!;
}

export async function updateSystemSettings(data: Record<string, unknown>) {
  const existing = await prisma.systemSettings.findFirst();
  if (!existing) {
    const created = await prisma.systemSettings.create({ data: data as never });
    return withMongoId(serializeNested(created))!;
  }
  const updated = await prisma.systemSettings.update({
    where: { id: existing.id },
    data: data as never
  });
  return withMongoId(serializeNested(updated))!;
}
