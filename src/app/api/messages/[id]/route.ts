import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { deleteMessage, editMessage } from "@/services/messages.service";

const editSchema = z.object({
  text: z.string().trim().min(1).max(5000)
});

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const { id } = await ctx.params;
    const body = editSchema.parse(await req.json());
    await editMessage(id, session.email, body.text);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const { id } = await ctx.params;
    await deleteMessage(id, session.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
