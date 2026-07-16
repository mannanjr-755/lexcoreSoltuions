import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type ActivityInput = {
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
};

export function getClientInfo(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const browser = userAgent.includes("Edg")
    ? "Edge"
    : userAgent.includes("Chrome")
      ? "Chrome"
      : userAgent.includes("Firefox")
        ? "Firefox"
        : userAgent.includes("Safari")
          ? "Safari"
          : "Other";
  return { ipAddress, userAgent, browser };
}

export async function logActivity(input: ActivityInput) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId || null,
        userName: input.userName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        description: input.description,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        browser: input.browser,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });
  } catch {
    // never block the main request on logging failures
  }
}
