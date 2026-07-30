import { prisma } from "@/lib/prisma";
import { AUTHORIZED_USERS, getAuthorizedUserByEmail, normalizeEmail } from "@/lib/authorized-users";
import type { Message } from "@/components/chat/chat-types";
import {
  getOnlineEmails,
  publishMessageCreated,
  publishMessageDeleted,
  publishMessageStatus,
  publishMessageUpdated,
  publishMessagesCleared
} from "@/services/messages-realtime.service";
import { HttpError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { promises as fs } from "node:fs";
import path from "node:path";

export type MessageAttachmentType = "image" | "file";

export type MessageAttachment = {
  id?: string;
  type: MessageAttachmentType;
  url: string;
  name: string;
  size: number;
  mime: string;
};

export type TeamMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  text: string;
  status: "sent" | "delivered" | "read";
  isEdited: boolean;
  isDeleted: boolean;
  replyToId: string | null;
  replyToText: string | null;
  replyToSenderName: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Array<Required<MessageAttachment> & { createdAt?: string }>;
};

type CreateMessageInput = {
  senderEmail: string;
  senderUserId?: string;
  text: string;
  replyToId?: string | null;
  attachments?: MessageAttachment[];
};

type ListMessagesParams = {
  limit?: number;
  before?: string | null;
};

const WORKSPACE_ID = "lexcore-solutions";
const ADMIN_EMAIL = "admin@lexcore.com";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

let schemaPromise: Promise<void> | null = null;

export function isChatAdmin(email: string) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

/**
 * Ensures chat tables match Prisma field maps (snake_case) and sender_id is nullable.
 */
export async function ensureChatSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "chat_messages" (
            "id" TEXT PRIMARY KEY,
            "workspace_id" TEXT NOT NULL DEFAULT 'lexcore-solutions',
            "sender_id" TEXT,
            "sender_name" TEXT NOT NULL,
            "sender_email" TEXT NOT NULL,
            "text" TEXT NOT NULL DEFAULT '',
            "status" TEXT NOT NULL DEFAULT 'sent',
            "is_edited" BOOLEAN NOT NULL DEFAULT false,
            "is_deleted" BOOLEAN NOT NULL DEFAULT false,
            "reply_to_id" TEXT,
            "reply_to_text" TEXT,
            "reply_to_sender_name" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "chat_attachments" (
            "id" TEXT PRIMARY KEY,
            "message_id" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "url" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "size" INTEGER NOT NULL DEFAULT 0,
            "mime" TEXT NOT NULL DEFAULT '',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await prisma.$executeRawUnsafe(`ALTER TABLE "chat_messages" ALTER COLUMN "sender_id" DROP NOT NULL`);
        await prisma.$executeRawUnsafe(`
          UPDATE "chat_messages" AS m
          SET "sender_id" = NULL
          WHERE m."sender_id" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = m."sender_id")
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "chat_messages_workspace_id_created_at_idx"
          ON "chat_messages" ("workspace_id", "created_at")
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "chat_messages_sender_email_created_at_idx"
          ON "chat_messages" ("sender_email", "created_at")
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "chat_attachments_message_id_idx"
          ON "chat_attachments" ("message_id")
        `);
      } catch (error) {
        schemaPromise = null;
        logger.warn("Chat schema reconcile skipped", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  }
  await schemaPromise;
}

function mapAttachment(attachment: {
  id: string;
  type: string;
  url: string;
  name: string;
  size: number;
  mime: string;
  createdAt?: Date;
}): Required<MessageAttachment> & { createdAt?: string } {
  return {
    id: attachment.id,
    type: attachment.type === "image" ? "image" : "file",
    url: attachment.url,
    name: attachment.name,
    size: attachment.size,
    mime: attachment.mime,
    ...(attachment.createdAt ? { createdAt: attachment.createdAt.toISOString() } : {})
  };
}

function mapMessage(row: {
  id: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string;
  text: string;
  status: string;
  isEdited: boolean;
  isDeleted: boolean;
  replyToId: string | null;
  replyToText: string | null;
  replyToSenderName: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Array<{
    id: string;
    type: string;
    url: string;
    name: string;
    size: number;
    mime: string;
    createdAt?: Date;
  }>;
}): TeamMessage {
  const status =
    row.status === "read" || row.status === "delivered" || row.status === "sent" ? row.status : "sent";

  return {
    id: row.id,
    senderId: row.senderId ?? row.senderEmail,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    text: row.text,
    status,
    isEdited: row.isEdited,
    isDeleted: row.isDeleted,
    replyToId: row.replyToId,
    replyToText: row.replyToText,
    replyToSenderName: row.replyToSenderName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachments: (row.attachments ?? []).map(mapAttachment)
  };
}

export async function listAllMessages(params: ListMessagesParams = {}) {
  await ensureChatSchema();

  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE));
  const before = params.before?.trim() || null;

  let beforeCreatedAt: Date | null = null;
  if (before) {
    const anchor = await prisma.chatMessage.findUnique({
      where: { id: before },
      select: { createdAt: true }
    });
    beforeCreatedAt = anchor?.createdAt ?? null;
  }

  const rows = await prisma.chatMessage.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {})
    },
    include: { attachments: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: limit + 1
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  // Return chronological order for the UI.
  const messages = page.reverse().map(mapMessage);

  return { messages, hasMore, limit };
}

export async function createMessage(input: CreateMessageInput): Promise<TeamMessage> {
  await ensureChatSchema();

  const email = normalizeEmail(input.senderEmail);
  const member = getAuthorizedUserByEmail(email);
  if (!member) {
    throw new HttpError(403, "Access Denied. You are not authorized to access this dashboard.");
  }

  const text = input.text.trim();
  const safeAttachments = (input.attachments ?? []).slice(0, 10).filter((attachment) => {
    if (!attachment?.url || typeof attachment.url !== "string") return false;
    return (
      attachment.url.startsWith("/uploads/messages/") ||
      attachment.url.startsWith("https://res.cloudinary.com/")
    );
  });

  if (!text && safeAttachments.length === 0) {
    throw new HttpError(400, "Message cannot be empty.");
  }

  let replyToText: string | null = null;
  let replyToSenderName: string | null = null;
  if (input.replyToId) {
    const reply = await prisma.chatMessage.findUnique({
      where: { id: input.replyToId },
      select: { text: true, senderName: true }
    });
    if (reply) {
      replyToText = reply.text;
      replyToSenderName = reply.senderName;
    }
  }

  let senderId: string | null = input.senderUserId ?? null;
  if (senderId) {
    const exists = await prisma.user.findUnique({ where: { id: senderId }, select: { id: true } });
    if (!exists) senderId = null;
  }
  if (!senderId) {
    const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    senderId = dbUser?.id ?? null;
  }

  const othersOnline = getOnlineEmails().some((online) => online !== email);
  const initialStatus = othersOnline ? "delivered" : "sent";

  const created = await prisma.chatMessage.create({
    data: {
      workspaceId: WORKSPACE_ID,
      senderId,
      senderName: member.name,
      senderEmail: member.email,
      text,
      status: initialStatus,
      replyToId: input.replyToId ?? null,
      replyToText,
      replyToSenderName,
      attachments: safeAttachments.length
        ? {
            create: safeAttachments.map((attachment) => ({
              ...(attachment.id ? { id: attachment.id } : {}),
              type: attachment.type,
              url: attachment.url,
              name: attachment.name,
              size: Math.max(0, Math.min(Number(attachment.size || 0), 2147483647)),
              mime: attachment.mime || ""
            }))
          }
        : undefined
    },
    include: { attachments: true }
  });

  const createdMessage = mapMessage(created);
  publishMessageCreated(createdMessage as unknown as Message);
  return createdMessage;
}

export async function editMessage(id: string, email: string, text: string) {
  await ensureChatSchema();
  const normalized = normalizeEmail(email);
  const existing = await prisma.chatMessage.findUnique({
    where: { id },
    select: { senderEmail: true }
  });
  if (!existing) throw new HttpError(404, "Record not found");
  if (normalizeEmail(existing.senderEmail) !== normalized) throw new HttpError(403, "Forbidden");

  const trimmed = text.trim();
  if (!trimmed) throw new HttpError(400, "Message text cannot be empty.");

  const updated = await prisma.chatMessage.update({
    where: { id },
    data: { text: trimmed, isEdited: true }
  });
  publishMessageUpdated(id, trimmed, updated.updatedAt.toISOString());
}

export async function deleteMessage(id: string, email: string) {
  await ensureChatSchema();
  const normalized = normalizeEmail(email);
  const isAdmin = isChatAdmin(normalized);
  const existing = await prisma.chatMessage.findUnique({
    where: { id },
    select: {
      senderEmail: true,
      attachments: { select: { url: true } }
    }
  });
  if (!existing) throw new HttpError(404, "Record not found");
  if (!isAdmin && normalizeEmail(existing.senderEmail) !== normalized) {
    throw new HttpError(403, "Forbidden");
  }

  await prisma.chatMessage.delete({ where: { id } });
  await removeLocalAttachments(existing.attachments.map((item) => item.url));
  publishMessageDeleted(id);
}

export async function clearAllMessages(email: string) {
  await ensureChatSchema();
  const normalized = normalizeEmail(email);
  if (!isChatAdmin(normalized)) {
    throw new HttpError(403, "Only Admin can clear the chat history.");
  }

  const attachments = await prisma.chatAttachment.findMany({
    where: { message: { workspaceId: WORKSPACE_ID } },
    select: { url: true }
  });

  await prisma.chatMessage.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  await removeLocalAttachments(attachments.map((item) => item.url));
  publishMessagesCleared(WORKSPACE_ID);
  logger.info("Chat cleared by admin", { workspaceId: WORKSPACE_ID, email: normalized });
  return { cleared: true };
}

export async function markMessagesRead(email: string) {
  await ensureChatSchema();
  const normalized = normalizeEmail(email);

  const unread = await prisma.chatMessage.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      NOT: { senderEmail: normalized },
      status: { not: "read" }
    },
    select: { id: true },
    take: 500
  });

  if (unread.length === 0) return { updated: 0 };

  const ids = unread.map((row) => row.id);
  await prisma.chatMessage.updateMany({
    where: { id: { in: ids } },
    data: { status: "read" }
  });
  publishMessageStatus(ids, "read");
  return { updated: ids.length };
}

async function removeLocalAttachments(urls: string[]) {
  for (const url of urls) {
    if (!url.startsWith("/uploads/messages/")) continue;
    const absolute = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    try {
      await fs.unlink(absolute);
    } catch {
      // File may already be gone; ignore.
    }
  }
}

export function listWorkspaceMembers() {
  const online = new Set(getOnlineEmails());
  return AUTHORIZED_USERS.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleTitle,
    color: user.color,
    isOnline: online.has(normalizeEmail(user.email))
  }));
}
