import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { sendOtpEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { getClientInfo, logActivity } from "@/lib/activity";

const forgotSchema = z.object({
  email: z.string().email()
});

export async function POST(req: Request) {
  try {
    const { ipAddress, userAgent, browser } = getClientInfo(req);
    const limit = rateLimit(`forgot:${ipAddress}`, 5, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: parsed.data.email.toLowerCase(), role: "super_admin" }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ message: "If the email exists, an OTP has been sent." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000), otpVerified: false }
    });

    try {
      await sendOtpEmail(user.email, otp, user.fullName);
    } catch (emailError) {
      return NextResponse.json(
        { message: emailError instanceof Error ? emailError.message : "Failed to send email" },
        { status: 503 }
      );
    }

    await logActivity({
      userId: user.id,
      userName: user.fullName,
      action: "forgot_password",
      description: "Password reset OTP requested",
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ message: "If the email exists, an OTP has been sent." });
  } catch (error) {
    return handleApiError(error);
  }
}
