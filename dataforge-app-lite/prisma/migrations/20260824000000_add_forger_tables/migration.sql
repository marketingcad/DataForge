-- Forger chat tables.
--
-- These two models have existed in prisma/schema.prisma for a while but never had a
-- migration: they were created by the `prisma db push` in vercel.json's build command.
-- Recording them as a real migration keeps schema.prisma, prisma/migrations and the
-- database in agreement, which is what lets the build use `prisma migrate deploy`
-- instead of `db push` (db push drops the raw-SQL dedup indexes it cannot represent).
--
-- DDL matches `prisma migrate diff --from-empty --to-schema prisma/schema.prisma`.

-- CreateTable
CREATE TABLE "ForgerConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgerConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForgerMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForgerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForgerConversation_userId_idx" ON "ForgerConversation"("userId");

-- CreateIndex
CREATE INDEX "ForgerMessage_conversationId_idx" ON "ForgerMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "ForgerMessage" ADD CONSTRAINT "ForgerMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ForgerConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
