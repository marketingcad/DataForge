-- Marketing system: CallLog, Badge, UserBadge, MarketingTask, TaskProgress
-- Also adds points column to User

CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');
CREATE TYPE "CallStatus"    AS ENUM ('completed', 'missed', 'voicemail', 'no_answer');

-- Add points to User
ALTER TABLE "User" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CallLog" (
  "id"           TEXT         NOT NULL,
  "agentId"      TEXT         NOT NULL,
  "contactName"  TEXT,
  "contactPhone" TEXT,
  "direction"    "CallDirection" NOT NULL DEFAULT 'outbound',
  "durationSecs" INTEGER        NOT NULL DEFAULT 0,
  "status"       "CallStatus"   NOT NULL DEFAULT 'completed',
  "calledAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"        TEXT,
  CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Badge" (
  "id"          TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon"        TEXT NOT NULL,
  "color"       TEXT NOT NULL DEFAULT '#6366f1',
  CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBadge" (
  "id"       TEXT         NOT NULL,
  "userId"   TEXT         NOT NULL,
  "badgeId"  TEXT         NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingTask" (
  "id"          TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "targetCalls" INTEGER      NOT NULL,
  "pointReward" INTEGER      NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskProgress" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "taskId"      TEXT         NOT NULL,
  "callCount"   INTEGER      NOT NULL DEFAULT 0,
  "completed"   BOOLEAN      NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "TaskProgress_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "CallLog_agentId_idx"    ON "CallLog"("agentId");
CREATE INDEX "CallLog_calledAt_idx"   ON "CallLog"("calledAt");
CREATE UNIQUE INDEX "Badge_key_key"   ON "Badge"("key");
CREATE INDEX "UserBadge_userId_idx"   ON "UserBadge"("userId");
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");
CREATE INDEX "TaskProgress_userId_idx" ON "TaskProgress"("userId");
CREATE UNIQUE INDEX "TaskProgress_userId_taskId_key" ON "TaskProgress"("userId", "taskId");

-- Foreign keys
ALTER TABLE "CallLog"      ADD CONSTRAINT "CallLog_agentId_fkey"           FOREIGN KEY ("agentId")  REFERENCES "User"("id")          ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge"    ADD CONSTRAINT "UserBadge_userId_fkey"          FOREIGN KEY ("userId")   REFERENCES "User"("id")          ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge"    ADD CONSTRAINT "UserBadge_badgeId_fkey"         FOREIGN KEY ("badgeId")  REFERENCES "Badge"("id")         ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskProgress" ADD CONSTRAINT "TaskProgress_userId_fkey"       FOREIGN KEY ("userId")   REFERENCES "User"("id")          ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskProgress" ADD CONSTRAINT "TaskProgress_taskId_fkey"       FOREIGN KEY ("taskId")   REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
