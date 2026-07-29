import { prisma } from "@/lib/prisma";
import { AUTHORIZED_USERS, getAuthorizedUserByEmail, normalizeEmail } from "@/lib/authorized-users";
import type { Message } from "@/components/chat/chat-types";
import { publishMessageCreated, publishMessageDeleted, publishMessageUpdated } from "@/services/messages-realtime.service";
import { HttpError } from "@/lib/api-error";

export type MessageAttachmentType = "image" | "file";

export type MessageAttachment = {
  id: string;
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
  attachments: MessageAttachment[];
};

type CreateMessageInput = {
  senderEmail: string;
  text: string;
  replyToId?: string | null;
  attachments?: MessageAttachment[];
};

const WORKSPACE_ID = "lexcore-solutions";
const ADMIN_EMAIL = "admin@lexcore.com";

async function ensureMessageTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sent',
      is_edited BOOLEAN NOT NULL DEFAULT FALSE,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      reply_to_id TEXT NULL,
      reply_to_text TEXT NULL,
      reply_to_sender_name TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      name TEXT NOT NULL,
      size BIGINT NOT NULL DEFAULT 0,
      mime TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace_created_at
    ON chat_messages(workspace_id, created_at DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id
    ON chat_attachments(message_id);
  `);
}

async function seedIfEmpty() {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM chat_messages WHERE workspace_id = $1`,
    WORKSPACE_ID
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count > 0) return;

  const seed = [
    { senderEmail: "admin@lexcore.com", text: "Hello Team 👋" },
    { senderEmail: "abdul@lexcore.com", text: "Customer module has been updated." },
    { senderEmail: "raid@lexcore.com", text: "Invoice system is completed." },
    { senderEmail: "yousuf@lexcore.com", text: "Testing has started." },
    { senderEmail: "anjasha@lexcore.com", text: "UI improvements are finished." }
  ];

  for (const item of seed) {
    const member = getAuthorizedUserByEmail(item.senderEmail);
    if (!member) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_messages (
        id, workspace_id, sender_id, sender_name, sender_email, text, status, is_edited, is_deleted
      ) VALUES ($1,$2,$3,$4,$5,$6,'read',FALSE,FALSE)`,
      crypto.randomUUID(),
      WORKSPACE_ID,
      member.id,
      member.name,
      member.email,
      item.text
    );
  }
}

export async function listAllMessages() {
  await ensureMessageTables();
  await seedIfEmpty();

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    sender_id: string;
    sender_name: string;
    sender_email: string;
    text: string;
    status: TeamMessage["status"];
    is_edited: boolean;
    is_deleted: boolean;
    reply_to_id: string | null;
    reply_to_text: string | null;
    reply_to_sender_name: string | null;
    created_at: Date;
    updated_at: Date;
    attachments: string | null;
  }>>(
    `
      SELECT
        m.id, m.sender_id, m.sender_name, m.sender_email, m.text, m.status, m.is_edited, m.is_deleted,
        m.reply_to_id, m.reply_to_text, m.reply_to_sender_name, m.created_at, m.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'type', a.type,
              'url', a.url,
              'name', a.name,
              'size', a.size,
              'mime', a.mime
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        )::text AS attachments
      FROM chat_messages m
      LEFT JOIN chat_attachments a ON a.message_id = m.id
      WHERE m.workspace_id = $1
      GROUP BY m.id
      ORDER BY m.created_at ASC
    `,
    WORKSPACE_ID
  );

  const messages: TeamMessage[] = rows.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    text: row.text,
    status: row.status,
    isEdited: row.is_edited,
    isDeleted: row.is_deleted,
    replyToId: row.reply_to_id,
    replyToText: row.reply_to_text,
    replyToSenderName: row.reply_to_sender_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    attachments: JSON.parse(row.attachments ?? "[]") as MessageAttachment[]
  }));

  return { messages };
}

export async function createMessage(input: CreateMessageInput): Promise<TeamMessage> {
  await ensureMessageTables();
  const email = normalizeEmail(input.senderEmail);
  const member = getAuthorizedUserByEmail(email);
  if (!member) {
    throw new HttpError(403, "Access Denied. You are not authorized to access this dashboard.");
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const text = input.text.trim();
  const safeAttachments = (input.attachments ?? []).slice(0, 10);

  if (!text && safeAttachments.length === 0) {
    throw new HttpError(400, "Message cannot be empty.");
  }

  let replyToText: string | null = null;
  let replyToSenderName: string | null = null;
  if (input.replyToId) {
    const replyRows = await prisma.$queryRawUnsafe<Array<{ text: string; sender_name: string }>>(
      `SELECT text, sender_name FROM chat_messages WHERE id = $1 LIMIT 1`,
      input.replyToId
    );
    if (replyRows.length) {
      replyToText = replyRows[0].text;
      replyToSenderName = replyRows[0].sender_name;
    }
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO chat_messages (
      id, workspace_id, sender_id, sender_name, sender_email, text, status, is_edited, is_deleted,
      reply_to_id, reply_to_text, reply_to_sender_name
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,FALSE,$8,$9,$10)`,
    id,
    WORKSPACE_ID,
    member.id,
    member.name,
    member.email,
    text,
    "sent",
    input.replyToId ?? null,
    replyToText,
    replyToSenderName
  );

  for (const attachment of safeAttachments) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_attachments (id, message_id, type, url, name, size, mime)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      attachment.id || crypto.randomUUID(),
      id,
      attachment.type,
      attachment.url,
      attachment.name,
      Math.max(0, Number(attachment.size || 0)),
      attachment.mime
    );
  }

  const createdMessage: TeamMessage = {
    id,
    senderId: member.id,
    senderName: member.name,
    senderEmail: member.email,
    text,
    status: "sent",
    isEdited: false,
    isDeleted: false,
    replyToId: input.replyToId ?? null,
    replyToText,
    replyToSenderName,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    attachments: safeAttachments
  };
  publishMessageCreated(createdMessage as unknown as Message);
  return createdMessage;
}

export async function editMessage(id: string, email: string, text: string) {
  await ensureMessageTables();
  const normalized = normalizeEmail(email);
  const rows = await prisma.$queryRawUnsafe<Array<{ sender_email: string }>>(
    `SELECT sender_email FROM chat_messages WHERE id = $1 LIMIT 1`,
    id
  );
  if (!rows.length) throw new HttpError(404, "Record not found");
  if (normalizeEmail(rows[0].sender_email) !== normalized) throw new HttpError(403, "Forbidden");

  await prisma.$executeRawUnsafe(
    `UPDATE chat_messages SET text = $2, is_edited = TRUE, updated_at = NOW() WHERE id = $1`,
    id,
    text.trim()
  );
  publishMessageUpdated(id, text.trim(), new Date().toISOString());
}

export async function deleteMessage(id: string, email: string) {
  await ensureMessageTables();
  const normalized = normalizeEmail(email);
  const isAdmin = normalized === ADMIN_EMAIL;
  const rows = await prisma.$queryRawUnsafe<Array<{ sender_email: string }>>(
    `SELECT sender_email FROM chat_messages WHERE id = $1 LIMIT 1`,
    id
  );
  if (!rows.length) throw new HttpError(404, "Record not found");
  if (!isAdmin && normalizeEmail(rows[0].sender_email) !== normalized) throw new HttpError(403, "Forbidden");

  await prisma.$executeRawUnsafe(`DELETE FROM chat_messages WHERE id = $1`, id);
  publishMessageDeleted(id);
}

export function listWorkspaceMembers() {
  return AUTHORIZED_USERS.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleTitle,
    color: user.color,
    isOnline: true
  }));
}
