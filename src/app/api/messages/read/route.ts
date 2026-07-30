import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { markMessagesRead } from "@/services/messages.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const result = await markMessagesRead(session.email);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
