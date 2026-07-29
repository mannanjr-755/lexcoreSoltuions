import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { createMessage, listAllMessages, listWorkspaceMembers } from "@/services/messages.service";

const createMessageSchema = z.object({
  text: z.string().max(5000).optional().default(""),
  replyToId: z.string().optional().nullable(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["image", "file"]),
        url: z.string(),
        name: z.string(),
        size: z.number().nonnegative(),
        mime: z.string()
      })
    )
    .max(10)
    .optional()
    .default([])
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const { messages } = await listAllMessages();

    return NextResponse.json({
      workspace: { id: "lexcore-solutions", name: "Lexcore Solutions" },
      members: listWorkspaceMembers(),
      messages
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const body = createMessageSchema.parse(await req.json());
    const message = await createMessage({
      senderEmail: session.email,
      text: body.text,
      replyToId: body.replyToId,
      attachments: body.attachments
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
