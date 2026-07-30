-- Align chat tables with Prisma ChatMessage / ChatAttachment models.
-- Root cause of Messages DB errors: tables used snake_case columns while Prisma
-- queried camelCase (P2022: column workspaceId does not exist).

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT NOT NULL,
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
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_attachments" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "mime" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- Allow messages without a resolved User FK (legacy slug ids / null).
ALTER TABLE "chat_messages" ALTER COLUMN "sender_id" DROP NOT NULL;

-- Clear legacy slug sender ids that are not real users.id values (e.g. "admin").
UPDATE "chat_messages" AS m
SET "sender_id" = NULL
WHERE m."sender_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = m."sender_id");

-- Ensure defaults used by Prisma create paths.
ALTER TABLE "chat_messages" ALTER COLUMN "workspace_id" SET DEFAULT 'lexcore-solutions';
ALTER TABLE "chat_messages" ALTER COLUMN "text" SET DEFAULT '';
ALTER TABLE "chat_messages" ALTER COLUMN "status" SET DEFAULT 'sent';
ALTER TABLE "chat_messages" ALTER COLUMN "is_edited" SET DEFAULT false;
ALTER TABLE "chat_messages" ALTER COLUMN "is_deleted" SET DEFAULT false;
ALTER TABLE "chat_attachments" ALTER COLUMN "size" SET DEFAULT 0;
ALTER TABLE "chat_attachments" ALTER COLUMN "mime" SET DEFAULT '';

-- Prisma model uses Int; legacy table used bigint.
ALTER TABLE "chat_attachments"
  ALTER COLUMN "size" TYPE INTEGER
  USING LEAST("size", 2147483647)::INTEGER;

CREATE INDEX IF NOT EXISTS "chat_messages_workspace_id_created_at_idx"
  ON "chat_messages" ("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_messages_sender_email_created_at_idx"
  ON "chat_messages" ("sender_email", "created_at");
CREATE INDEX IF NOT EXISTS "chat_attachments_message_id_idx"
  ON "chat_attachments" ("message_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_sender_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_sender_id_fkey"
      FOREIGN KEY ("sender_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_attachments_message_id_fkey'
  ) THEN
    ALTER TABLE "chat_attachments"
      ADD CONSTRAINT "chat_attachments_message_id_fkey"
      FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
