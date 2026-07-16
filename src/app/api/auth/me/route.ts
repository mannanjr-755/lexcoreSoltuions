import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/models/User";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { REFRESH_COOKIE } from "@/lib/cookies";
import { verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { setAuthCookies } from "@/lib/cookies";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await connectDb();
    const user = await UserModel.findById(session.id).select(
      "-passwordHash -otpCode -passwordResetToken -smtpPass"
    );
    if (!user) return unauthorized();

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profilePhoto: user.profilePhoto,
        company: user.company,
        designation: user.designation,
        address: user.address,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) return unauthorized();

    const payload = verifyRefreshToken(refreshToken);
    const newAccess = signAccessToken({ sub: payload.sub, role: payload.role, email: payload.email });

    const response = NextResponse.json({ message: "Token refreshed" });
    setAuthCookies(response, { accessToken: newAccess, refreshToken });
    return response;
  } catch {
    return unauthorized();
  }
}
