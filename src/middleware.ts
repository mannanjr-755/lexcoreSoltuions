import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";
import { isAuthorizedEmail } from "@/lib/authorized-users";

const publicPaths = ["/login", "/forgot-password", "/reset-password", "/unauthorized"];
const publicApiPaths = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/setup/seed",
  "/api/health"
];

function hasValidToken(value?: string) {
  return Boolean(value && value.trim().length > 20);
}

function parseEmailFromJwt(token?: string): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    const json = JSON.parse(decoded) as { email?: string };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const isAuthenticated = hasValidToken(accessToken) || hasValidToken(refreshToken);
  const tokenEmail = parseEmailFromJwt(accessToken) ?? parseEmailFromJwt(refreshToken);
  const hasAuthorizedEmail = tokenEmail ? isAuthorizedEmail(tokenEmail) : false;

  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (isAuthenticated && (pathname === "/login" || pathname.startsWith("/login/"))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (publicApiPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !isAuthenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (isAuthenticated && tokenEmail && !hasAuthorizedEmail) {
    const deniedUrl = new URL("/login", request.url);
    deniedUrl.searchParams.set("error", "Access Denied. You are not authorized to access this dashboard.");
    const response = NextResponse.redirect(deniedUrl);
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  if (!pathname.startsWith("/api/") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
