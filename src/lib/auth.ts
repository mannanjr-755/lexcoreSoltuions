import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";
import { UserModel } from "@/models/User";
import type { AuthUser } from "@/types/auth";
import { hasPermission, type Permission } from "@/types/permissions";

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      await connectDb();
      const user = await UserModel.findById(payload.sub).select("fullName email role profilePhoto isActive");
      if (!user || !user.isActive) return null;
      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto ?? undefined
      };
    } catch {
      // fall through to refresh
    }
  }

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await connectDb();
      const user = await UserModel.findById(payload.sub).select("fullName email role profilePhoto isActive");
      if (!user || !user.isActive) return null;
      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto ?? undefined
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function requireSession(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const session = await requireSession();
  if (!hasPermission(session.role, permission)) {
    throw new Error("Forbidden");
  }
  return session;
}

export function refreshAccessFromRefreshToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  return signAccessToken({ sub: payload.sub, role: payload.role, email: payload.email });
}
