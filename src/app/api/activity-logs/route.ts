import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ActivityLogModel } from "@/models/ActivityLog";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

    await connectDb();
    const [logs, total] = await Promise.all([
      ActivityLogModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLogModel.countDocuments()
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}
