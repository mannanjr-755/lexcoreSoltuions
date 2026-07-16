import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { setAuthCookies } from "@/lib/cookies";
import { handleApiError } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { comparePassword } from "@/lib/bcrypt";
import { ensureSuperAdmin } from "@/lib/ensure-admin";
import { LOGIN_LOCK_DURATION_MS, LOGIN_LOCK_THRESHOLD } from "@/types/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .email("Enter a valid email address"),
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters"),
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

    await ensureSuperAdmin();

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ message: "Account not found. Check your email address." }, { status: 401 });
    }

    if (user.role !== "super_admin") {
      await prisma.loginHistory.create({
        data: {
        userId: user.id,
        ipAddress,
        userAgent,
        browser,
        success: false,
        failureReason: "Only Super Admin can login"
        }
      });
      return NextResponse.json({ message: "Access denied. Only Super Admin can login." }, { status: 403 });
    }

    if (!user.isActive) {
      return NextResponse.json({ message: "Account is inactive. Contact support." }, { status: 403 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { message: `Account locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    const isValid = await comparePassword(parsed.data.password, user.passwordHash);
    if (!isValid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts >= LOGIN_LOCK_THRESHOLD ? 0 : attempts,
          lockedUntil: attempts >= LOGIN_LOCK_THRESHOLD ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS) : null
        }
      });

      await prisma.loginHistory.create({
        data: {
        userId: user.id,
        ipAddress,
        userAgent,
        browser,
        success: false,
        failureReason: "Invalid password"
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
      description: "Super Admin logged in",
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
    logger.info("Super Admin login successful", { email: user.email });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
