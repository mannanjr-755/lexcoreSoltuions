import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";
import type { AuthUser } from "@/types/auth";
import { hasPermission, type Permission } from "@/types/permissions";
import { isAuthorizedEmail } from "@/lib/authorized-users";

type SessionCacheEntry = { user: AuthUser; expiresAt: number };

const sessionCache = new Map<string, SessionCacheEntry>();
const SESSION_CACHE_TTL_MS = 5_000;
const SESSION_CACHE_MAX = 200;

function cacheSession(key: string, user: AuthUser) {
  if (sessionCache.size >= SESSION_CACHE_MAX) {
    const oldest = sessionCache.keys().next().value;
    if (oldest) sessionCache.delete(oldest);
  }
  sessionCache.set(key, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
}

function getCachedSession(key: string): AuthUser | null {
  const hit = sessionCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    sessionCache.delete(key);
    return null;
  }
  return hit.user;
}

async function loadActiveUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true, role: true, profilePhoto: true, isActive: true }
  });
  if (!user || !user.isActive || !isAuthorizedEmail(user.email)) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    profilePhoto: user.profilePhoto ?? undefined
  };
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const cached = getCachedSession(`access:${accessToken}`);
    if (cached) return cached;

    try {
      const payload = verifyAccessToken(accessToken);
      const user = await loadActiveUser(payload.sub);
      if (!user) return null;
      cacheSession(`access:${accessToken}`, user);
      return user;
    } catch {
      // fall through to refresh
    }
  }

  if (refreshToken) {
    const cached = getCachedSession(`refresh:${refreshToken}`);
    if (cached) return cached;

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await loadActiveUser(payload.sub);
      if (!user) return null;
      cacheSession(`refresh:${refreshToken}`, user);
      return user;
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
