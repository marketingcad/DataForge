-- Kanban, Calendar, Chat, Notifications, Feedback Report

-- Enums
DO $$ BEGIN CREATE TYPE "KanbanColumn"   AS ENUM ('backlog','in_progress','in_review','done');   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "KanbanPriority" AS ENUM ('low','medium','high');                         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeedbackType"   AS ENUM ('bug','feature');                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeedbackStatus" AS ENUM ('open','in_review','resolved','closed');        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NotifType"      AS ENUM ('success','info','warning','error');             EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- KanbanTask
CREATE TABLE IF NOT EXISTS "KanbanTask" (
  "id"          TEXT            NOT NULL,
  "title"       TEXT            NOT NULL,
  "description" TEXT,
  "column"      "KanbanColumn"  NOT NULL DEFAULT 'backlog',
  "priority"    "KanbanPriority" NOT NULL DEFAULT 'medium',
  "dueDate"     TIMESTAMP(3),
  "tags"        TEXT[]          NOT NULL DEFAULT '{}',
  "position"    INTEGER         NOT NULL DEFAULT 0,
  "createdById" TEXT            NOT NULL,
  "assigneeId"  TEXT,
  "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KanbanTask_pkey" PRIMARY KEY ("id")
);

-- KanbanComment
CREATE TABLE IF NOT EXISTS "KanbanComment" (
  "id"        TEXT         NOT NULL,
  "taskId"    TEXT         NOT NULL,
  "authorId"  TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KanbanComment_pkey" PRIMARY KEY ("id")
);

-- CalendarEvent
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id"          TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3),
  "allDay"      BOOLEAN      NOT NULL DEFAULT true,
  "color"       TEXT         NOT NULL DEFAULT '#6366f1',
  "createdById" TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- DbNotification
CREATE TABLE IF NOT EXISTS "DbNotification" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "type"      "NotifType"  NOT NULL DEFAULT 'info',
  "title"     TEXT         NOT NULL,
  "message"   TEXT,
  "link"      TEXT,
  "read"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DbNotification_pkey" PRIMARY KEY ("id")
);

-- ChatMessage
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id"        TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "senderId"  TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- FeedbackReport
CREATE TABLE IF NOT EXISTS "FeedbackReport" (
  "id"          TEXT             NOT NULL,
  "type"        "FeedbackType"   NOT NULL,
  "title"       TEXT             NOT NULL,
  "description" TEXT             NOT NULL,
  "status"      "FeedbackStatus" NOT NULL DEFAULT 'open',
  "priority"    TEXT             NOT NULL DEFAULT 'medium',
  "submittedBy" TEXT             NOT NULL,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "KanbanTask_column_idx"      ON "KanbanTask"("column");
CREATE INDEX IF NOT EXISTS "KanbanTask_createdById_idx" ON "KanbanTask"("createdById");
CREATE INDEX IF NOT EXISTS "KanbanTask_assigneeId_idx"  ON "KanbanTask"("assigneeId");
CREATE INDEX IF NOT EXISTS "KanbanComment_taskId_idx"   ON "KanbanComment"("taskId");
CREATE INDEX IF NOT EXISTS "KanbanComment_authorId_idx" ON "KanbanComment"("authorId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_startDate_idx"   ON "CalendarEvent"("startDate");
CREATE INDEX IF NOT EXISTS "CalendarEvent_createdById_idx" ON "CalendarEvent"("createdById");
CREATE INDEX IF NOT EXISTS "DbNotification_userId_idx"      ON "DbNotification"("userId");
CREATE INDEX IF NOT EXISTS "DbNotification_userId_read_idx" ON "DbNotification"("userId", "read");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx"  ON "ChatMessage"("senderId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "FeedbackReport_submittedBy_idx" ON "FeedbackReport"("submittedBy");
CREATE INDEX IF NOT EXISTS "FeedbackReport_status_idx"      ON "FeedbackReport"("status");

-- Foreign keys
ALTER TABLE "KanbanTask"    ADD CONSTRAINT "KanbanTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KanbanTask"    ADD CONSTRAINT "KanbanTask_assigneeId_fkey"  FOREIGN KEY ("assigneeId")  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KanbanComment" ADD CONSTRAINT "KanbanComment_taskId_fkey"   FOREIGN KEY ("taskId")      REFERENCES "KanbanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KanbanComment" ADD CONSTRAINT "KanbanComment_authorId_fkey" FOREIGN KEY ("authorId")    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DbNotification" ADD CONSTRAINT "DbNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage"   ADD CONSTRAINT "ChatMessage_senderId_fkey"   FOREIGN KEY ("senderId")    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
