import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getClientInfo, logActivity } from "@/lib/activity";

const profileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  designation: z.string().optional(),
  address: z.string().optional(),
  profilePhoto: z.string().url().optional().nullable()
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true, fullName: true, email: true, role: true, phone: true, company: true,
        designation: true, address: true, profilePhoto: true, lastLoginAt: true, createdAt: true
      }
    });
    if (!user) return unauthorized();

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: parsed.data,
      select: {
        id: true, fullName: true, email: true, role: true, phone: true, company: true,
        designation: true, address: true, profilePhoto: true, lastLoginAt: true, createdAt: true
      }
    });

    const { ipAddress, userAgent, browser } = getClientInfo(req);
    await logActivity({
      userId: session.id,
      userName: session.fullName,
      action: "profile_updated",
      entity: "user",
      entityId: session.id,
      description: "Profile updated",
      ipAddress,
      userAgent,
      browser
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
