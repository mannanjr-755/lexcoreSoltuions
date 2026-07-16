import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/models/User";
import { handleApiError } from "@/lib/api-error";

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6)
});

export async function POST(req: Request) {
  try {
    await connectDb();
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid OTP format" }, { status: 400 });
    }

    const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase(), role: "super_admin" });
    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return NextResponse.json({ message: "Invalid or expired OTP" }, { status: 400 });
    }

    if (user.otpExpiresAt < new Date()) {
      return NextResponse.json({ message: "OTP has expired" }, { status: 400 });
    }

    if (user.otpCode !== parsed.data.otp) {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
    }

    user.otpVerified = true;
    await user.save();

    return NextResponse.json({ message: "OTP verified successfully", verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}
