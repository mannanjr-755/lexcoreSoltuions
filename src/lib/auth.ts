import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";
import type { AuthUser } from "@/types/auth";
import { hasPermission, type Permission } from "@/types/permissions";

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, fullName: true, email: true, role: true, profilePhoto: true, isActive: true }
      });
      if (!user || !user.isActive) return null;
      return {
        id: user.id,
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
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, fullName: true, email: true, role: true, profilePhoto: true, isActive: true }
      });
      if (!user || !user.isActive) return null;
      return {
        id: user.id,
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
