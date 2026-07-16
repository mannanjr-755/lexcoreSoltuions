import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getSystemSettings, SystemSettingsModel } from "@/models/SystemSettings";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized, forbidden } from "@/lib/api-error";
import { hasPermission } from "@/types/permissions";
import { getClientInfo, logActivity } from "@/lib/activity";

const settingsSchema = z.object({
  companyName: z.string().min(2).optional(),
  companyLogo: z.string().optional(),
  companyAddress: z.string().optional(),
  companyEmail: z.string().email().optional(),
  companyPhone: z.string().optional(),
  companyWebsite: z.string().url().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  theme: z.enum(["dark", "light"]).optional(),
  backupEnabled: z.boolean().optional(),
  backupSchedule: z.string().optional(),
  sessionTimeoutMinutes: z.number().min(5).optional(),
  maxLoginAttempts: z.number().min(3).optional(),
  lockoutDurationMinutes: z.number().min(5).optional(),
  dashboardLayout: z.record(z.string(), z.unknown()).optional()
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!hasPermission(session.role, "settings:read")) return forbidden();

    await connectDb();
    const settings = await getSystemSettings();
    const safe = settings.toObject();
    if (safe.smtpPass) safe.smtpPass = "********";

    return NextResponse.json({ settings: safe });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!hasPermission(session.role, "settings:write")) return forbidden();

    await connectDb();
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const update = { ...parsed.data };
    if (update.smtpPass === "********") delete update.smtpPass;

    const settings = await SystemSettingsModel.findOneAndUpdate({}, update, { new: true, upsert: true });
    const safe = settings!.toObject();
    if (safe.smtpPass) safe.smtpPass = "********";

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "settings_updated",
      entity: "settings",
      description: "System settings updated",
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ settings: safe });
  } catch (error) {
    return handleApiError(error);
  }
}
