import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.activityLog.count()
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}
