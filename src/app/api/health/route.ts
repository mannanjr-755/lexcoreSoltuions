import { NextResponse } from "next/server";
import { connectDb, isDbHealthy } from "@/lib/db";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await connectDb();
    const healthy = await isDbHealthy();
    return NextResponse.json({
      status: healthy ? "ok" : "degraded",
      mongodb: healthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
