import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/cookies";
import { getSession } from "@/lib/auth";
import { logActivity, getClientInfo } from "@/lib/activity";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const { ipAddress, userAgent, browser } = getClientInfo(req);

    if (session) {
      await logActivity({
        userId: session.id,
        userName: session.fullName,
        action: "logout",
        description: "Super Admin logged out",
        ipAddress,
        userAgent,
        browser
      });
    }

    const response = NextResponse.json({ message: "Logged out successfully" });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
