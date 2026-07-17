/** One-shot Neon connectivity + schema verification (no secrets logged). */
import "./load-env.mjs";
import { PrismaClient } from "@prisma/client";
import { preparePrismaEnv } from "./prisma-env.mjs";

preparePrismaEnv();
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  await prisma.$queryRaw`SELECT 1`;
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const admin = await prisma.user.findFirst({ where: { role: "super_admin" }, select: { email: true, role: true } });
  console.log(JSON.stringify({
    connected: true,
    tableCount: tables.length,
    usersTableExists: tables.some((t) => t.tablename === "users"),
    superAdmin: admin?.email ?? null,
    tables: tables.map((t) => t.tablename)
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
