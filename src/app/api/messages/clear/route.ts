import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { clearAllMessages } from "@/services/messages.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    await clearAllMessages(session.email);
    return NextResponse.json({ success: true, message: "Chat history cleared." });
  } catch (error) {
    return handleApiError(error);
  }
}
