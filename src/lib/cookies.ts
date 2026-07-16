import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "lexcore_access";
export const REFRESH_COOKIE = "lexcore_refresh";
export const CSRF_COOKIE = "lexcore_csrf";

const isProduction = process.env.NODE_ENV === "production";

const cookieBase = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/"
};

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
  rememberMe = false
) {
  // Access: 1 day (or 7 with remember me). Refresh: 7 days (or 30).
  const accessMaxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
  const refreshMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieBase,
    maxAge: accessMaxAge
  });

  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieBase,
    maxAge: refreshMaxAge
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieBase, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export function generateCsrfToken() {
  return crypto.randomUUID();
}

export function setCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/"
  });
}
