import { connectDb } from "@/lib/db";
import { ActivityLogModel } from "@/models/ActivityLog";

interface LogActivityParams {
  userId?: string;
  userName: string;
  action: string;
  entity?: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  metadata?: Record<string, unknown>;
}

export function parseUserAgent(userAgent: string) {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Unknown";
}

export async function logActivity(params: LogActivityParams) {
  await connectDb();
  await ActivityLogModel.create({
    userId: params.userId,
    userName: params.userName,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    description: params.description,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    browser: params.browser ?? (params.userAgent ? parseUserAgent(params.userAgent) : undefined),
    metadata: params.metadata
  });
}

export function getClientInfo(req: Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const browser = parseUserAgent(userAgent);
  return { ipAddress, userAgent, browser };
}
