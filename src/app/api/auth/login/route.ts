import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { setAuthCookies } from "@/lib/cookies";
import { handleApiError } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/bcrypt";
import { ensureSuperAdmin } from "@/lib/ensure-admin";
import { LOGIN_LOCK_DURATION_MS, LOGIN_LOCK_THRESHOLD } from "@/types/auth";
import { logger } from "@/lib/logger";
import { assertAuthEnv, getRawDatabaseUrl, assertValidDatabaseUrl } from "@/lib/database-url";
import { ensureAuthorizedUsers, repairAuthorizedPasswordHash } from "@/lib/ensure-authorized-users";
import { isAuthorizedEmail, normalizeEmail } from "@/lib/authorized-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const loginSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .email("Enter a valid email address"),
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  rememberMe: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.null()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "on")
});

export async function POST(req: Request) {
  try {
    const { ipAddress, userAgent, browser } = getClientInfo(req);
    const limit = rateLimit(`login:${ipAddress}`, 20, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ message: "Too many login attempts. Try again later." }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          message: first?.message ?? "Invalid email or password format",
          errors: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    assertValidDatabaseUrl(getRawDatabaseUrl(), "DATABASE_URL");
    assertAuthEnv();

    await ensureSuperAdmin();
    await ensureAuthorizedUsers();

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;

    if (!isAuthorizedEmail(email)) {
      logger.warn("Login blocked for unauthorized email", { email, ipAddress });
      return NextResponse.json(
        { message: "Access Denied. You are not authorized to access this dashboard." },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      logger.warn("Login failed: user not found", { email, ipAddress });
      return NextResponse.json({ message: "User not found." }, { status: 401 });
    }

    if (!user.isActive) {
      logger.warn("Login failed: inactive account", { email, ipAddress });
      return NextResponse.json({ message: "Account is inactive. Contact support." }, { status: 403 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      logger.warn("Login failed: account locked", { email, ipAddress, minutesLeft });
      return NextResponse.json(
        { message: `Account locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    let isValid = await verifyPassword(password, user.passwordHash);

    // Heal seed/env drift: correct configured password typed, but DB hash outdated/corrupt.
    if (!isValid) {
      const repaired = await repairAuthorizedPasswordHash(email, password);
      if (repaired) {
        isValid = true;
      }
    }

    if (!isValid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      const locked = attempts >= LOGIN_LOCK_THRESHOLD;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: locked ? 0 : attempts,
          lockedUntil: locked ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS) : null
        }
      });

      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress,
          userAgent,
          browser,
          success: false,
          failureReason: "Incorrect password"
        }
      });

      await logActivity({
        userId: user.id,
        userName: user.fullName,
        action: "failed_login",
        description: `Failed login attempt for ${user.email}`,
        ipAddress,
        userAgent,
        browser
      });

      logger.warn("Login failed: incorrect password", {
        email: user.email,
        ipAddress,
        attempts,
        locked
      });

      return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
    }

    const loggedInAt = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: loggedInAt, lastLoginIp: ipAddress }
    });

    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        browser,
        success: true
      }
    });

    await logActivity({
      userId: user.id,
      userName: user.fullName,
      action: "login",
      description: "User logged in",
      ipAddress,
      userAgent,
      browser
    });

    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email
    };

    const rememberMe = parsed.data.rememberMe;
    const accessToken = signAccessToken(payload, rememberMe);
    const refreshToken = signRefreshToken(payload, rememberMe);

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      redirectTo: "/dashboard",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto,
        lastLoginAt: loggedInAt
      }
    });

    setAuthCookies(response, { accessToken, refreshToken }, rememberMe);
    response.headers.set("Cache-Control", "no-store");
    logger.info("Login successful", { email: user.email });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
