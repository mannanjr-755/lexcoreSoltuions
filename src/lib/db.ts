import { prisma } from "@/lib/prisma";

export async function connectDb() {
  // Prisma connects lazily; this warms the pool and fails fast if DATABASE_URL is bad.
  await prisma.$queryRaw`SELECT 1`;
}

export async function isDbHealthy() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
