import { prisma } from "@/lib/prisma";

export async function connectDb() {
  await prisma.user.findFirst({ select: { id: true } });
}

export async function isDbHealthy() {
  try {
    await prisma.user.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
}
