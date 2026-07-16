import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { REFRESH_COOKIE } from "@/lib/cookies";
import { verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { setAuthCookies } from "@/lib/cookies";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true, fullName: true, email: true, role: true, phone: true, profilePhoto: true,
        company: true, designation: true, address: true, lastLoginAt: true, lastLoginIp: true, createdAt: true
      }
    });
    if (!user) return unauthorized();

    return NextResponse.json({
      user: {
        id: user.id,
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
