import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { comparePassword, hashPassword } from "@/lib/bcrypt";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8).max(128),
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

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return unauthorized();

    const isValid = await comparePassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) }
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

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
