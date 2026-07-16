import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/models/User";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";

const profileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  designation: z.string().optional(),
  address: z.string().optional(),
  profilePhoto: z.string().url().optional().nullable()
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await connectDb();
    const user = await UserModel.findById(session.id).select("-passwordHash -otpCode -passwordResetToken");
    if (!user) return unauthorized();

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await connectDb();
    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const user = await UserModel.findByIdAndUpdate(session.id, parsed.data, { new: true }).select(
      "-passwordHash -otpCode -passwordResetToken"
    );

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "profile_updated",
      entity: "user",
      entityId: session.id,
      description: "Profile updated",
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
