import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { hashPassword, verifyPassword } from "@/lib/bcrypt";
import { logger } from "@/lib/logger";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "Current password is required").max(128),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "New password must include a letter")
      .regex(/[0-9]/, "New password must include a number"),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"]
  });

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { message: first?.message ?? "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return unauthorized();

    const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      logger.warn("Change password failed: incorrect current password", { email: user.email });
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "password_changed",
      description: "Password changed successfully",
      ipAddress,
      userAgent,
      browser
    });

    logger.info("Password changed", { email: user.email });
    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
