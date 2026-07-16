import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/models/User";
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
    await connectDb();
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase(), role: "super_admin" });
    if (!user || !user.otpVerified || user.otpCode !== parsed.data.otp) {
      return NextResponse.json({ message: "Invalid or unverified OTP" }, { status: 400 });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return NextResponse.json({ message: "OTP has expired" }, { status: 400 });
    }

    user.passwordHash = await hashPassword(parsed.data.newPassword);
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpVerified = false;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: user._id.toString(),
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
