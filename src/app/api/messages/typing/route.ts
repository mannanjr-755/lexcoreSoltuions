import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { publishTyping } from "@/services/messages-realtime.service";

const typingSchema = z.object({
  isTyping: z.boolean()
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const { isTyping } = typingSchema.parse(await req.json());
    publishTyping(session.email, isTyping);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
