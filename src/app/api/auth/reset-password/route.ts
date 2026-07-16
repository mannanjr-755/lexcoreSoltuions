import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/bcrypt";

const resetSchema = z
  .object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: parsed.data.email.toLowerCase(), role: "super_admin" }
    });
    if (!user || !user.otpVerified || user.otpCode !== parsed.data.otp) {
      return NextResponse.json({ message: "Invalid or unverified OTP" }, { status: 400 });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return NextResponse.json({ message: "OTP has expired" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        otpCode: null,
        otpExpiresAt: null,
        otpVerified: false,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: user.id,
      userName: user.fullName,
      action: "password_reset",
      description: "Password reset via OTP",
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
