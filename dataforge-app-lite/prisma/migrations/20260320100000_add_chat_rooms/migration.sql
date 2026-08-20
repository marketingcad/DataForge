-- Add group chat support: ChatRoom, ChatRoomMember, update ChatMessage with roomId

DO $$ BEGIN CREATE TYPE "ChatRoomType" AS ENUM ('general','group'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ChatRoom
CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id"          TEXT           NOT NULL,
  "name"        TEXT           NOT NULL,
  "type"        "ChatRoomType" NOT NULL DEFAULT 'group',
  "createdById" TEXT           NOT NULL,
  "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- ChatRoomMember
CREATE TABLE IF NOT EXISTS "ChatRoomMember" (
  "id"       TEXT         NOT NULL,
  "roomId"   TEXT         NOT NULL,
  "userId"   TEXT         NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatRoomMember_roomId_userId_key" UNIQUE ("roomId", "userId")
);

-- Add roomId to ChatMessage (nullable first, then we'll fill and constrain)
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "roomId" TEXT;

-- Create the General room
INSERT INTO "ChatRoom" ("id","name","type","createdById","createdAt","updatedAt")
SELECT gen_random_uuid()::text, 'General', 'general', (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "ChatRoom" WHERE type = 'general');

-- Assign existing messages to General room
UPDATE "ChatMessage" SET "roomId" = (SELECT id FROM "ChatRoom" WHERE type = 'general' LIMIT 1)
WHERE "roomId" IS NULL;

-- Make roomId NOT NULL
ALTER TABLE "ChatMessage" ALTER COLUMN "roomId" SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "ChatRoom_createdById_idx"      ON "ChatRoom"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId","userId");
CREATE INDEX IF NOT EXISTS "ChatRoomMember_roomId_idx"     ON "ChatRoomMember"("roomId");
CREATE INDEX IF NOT EXISTS "ChatRoomMember_userId_idx"     ON "ChatRoomMember"("userId");
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_idx"        ON "ChatMessage"("roomId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "ChatRoom"       ADD CONSTRAINT "ChatRoom_createdById_fkey"       FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey"      FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey"      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage"    ADD CONSTRAINT "ChatMessage_roomId_fkey"         FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
