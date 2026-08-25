-- DataForge — complete schema for a NEW Supabase project.
-- Generated 2026-08-25T15:31:26Z from prisma/schema.prisma via:
--   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
--
-- Paste this whole file into the new project's SQL Editor and run it. That avoids
-- 'prisma migrate deploy', which needs the port-5432 direct connection (ISP-blocked here)
-- and session-level advisory locks the transaction pooler does not provide.
--
-- Covers all 45 tables, 103 indexes and 63 foreign keys, including ForgerConversation
-- and ForgerMessage (which exist in schema.prisma but have no migration file).
-- The lead dedup indexes from prisma/migrations/20260825000000_add_lead_dedup_indexes
-- are appended at the end, so uniqueness is enforced before any data is loaded.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('boss', 'admin', 'team_lead', 'sales_rep', 'lead_specialist');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('completed', 'missed', 'voicemail', 'no_answer');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'flagged', 'invalid');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'paused');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('serpapi', 'manual');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('bug', 'feature');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('open', 'in_review', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "KanbanColumn" AS ENUM ('backlog', 'in_progress', 'in_review', 'done');

-- CreateEnum
CREATE TYPE "KanbanPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('success', 'info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('general', 'group', 'direct', 'announcement');

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "industryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "userId" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "userId" TEXT NOT NULL,
    "industryId" TEXT,
    "subcategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "contactPerson" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL,
    "dateCollected" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'active',
    "duplicateFlag" BOOLEAN NOT NULL DEFAULT false,
    "dataQualityScore" INTEGER NOT NULL DEFAULT 0,
    "industriesFoundIn" TEXT[],
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "folderId" TEXT,
    "savedById" TEXT,
    "keywordId" TEXT,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "migratedToGhl" BOOLEAN NOT NULL DEFAULT false,
    "migratedToGhlAt" TIMESTAMP(3),
    "ghlContactId" TEXT,
    "exportedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "nickname" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'lead_specialist',
    "points" INTEGER NOT NULL DEFAULT 0,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedUntil" TIMESTAMP(3),
    "banReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ghlUserId" TEXT,
    "balloonPoints" INTEGER NOT NULL DEFAULT 0,
    "balloonSuspendedUntil" TIMESTAMP(3),
    "balloonDailyApptCount" INTEGER NOT NULL DEFAULT 0,
    "balloonDailyWindowStart" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Balloon" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prize" TEXT NOT NULL DEFAULT '',
    "isPopped" BOOLEAN NOT NULL DEFAULT false,
    "poppedById" TEXT,
    "poppedAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paymentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Balloon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'outbound',
    "durationSecs" INTEGER NOT NULL DEFAULT 0,
    "status" "CallStatus" NOT NULL DEFAULT 'completed',
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "ghlMessageId" TEXT,
    "leadId" TEXT,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "imageUrl" TEXT,
    "criteriaType" TEXT,
    "criteriaValue" INTEGER,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetCalls" INTEGER NOT NULL,
    "pointReward" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "MarketingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "submittedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackComment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "column" "KanbanColumn" NOT NULL DEFAULT 'backlog',
    "priority" "KanbanPriority" NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "tags" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KanbanComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChatRoomType" NOT NULL DEFAULT 'group',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "maxLeads" INTEGER NOT NULL DEFAULT 50,
    "source" "JobSource" NOT NULL DEFAULT 'serpapi',
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "leadsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "leadsProcessed" INTEGER NOT NULL DEFAULT 0,
    "duplicatesFound" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "keywordId" TEXT,
    "startedById" TEXT,
    "deviceId" TEXT,
    "pendingLeads" JSONB,
    "startTime" TIMESTAMP(3),
    "completedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'DataForge',
    "scrapingDefaultMaxLeads" INTEGER NOT NULL DEFAULT 50,
    "scrapingDefaultInterval" INTEGER NOT NULL DEFAULT 1440,
    "scrapingGlobalPause" BOOLEAN NOT NULL DEFAULT false,
    "scrapingBoost" BOOLEAN NOT NULL DEFAULT false,
    "scrapingMaxRunMinutes" INTEGER NOT NULL DEFAULT 0,
    "scraperMaxConcurrency" INTEGER NOT NULL DEFAULT 3,
    "leadQualityGoodThreshold" INTEGER NOT NULL DEFAULT 70,
    "leadQualityMediumThreshold" INTEGER NOT NULL DEFAULT 40,
    "ghlWebhookUrl" TEXT,
    "commissionCurrency" TEXT NOT NULL DEFAULT '₱',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ghlApiKey" TEXT,
    "ghlSubAccountApiKey" TEXT,
    "ghlLocationId" TEXT,
    "ghlCallsLastSyncedAt" TIMESTAMP(3),
    "ghlOppsLastSyncedAt" TIMESTAMP(3),
    "ghlAppsLastSyncedAt" TIMESTAMP(3),
    "balloonEnabled" BOOLEAN NOT NULL DEFAULT true,
    "balloonApptsPerPoint" INTEGER NOT NULL DEFAULT 1,
    "ghlInboundSecret" TEXT,
    "webhookLastPayload" TEXT,
    "webhookLastOutcome" TEXT,
    "reportsShareToken" TEXT,
    "disabledFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "forgerApiKey" TEXT,
    "forgerModel" TEXT,
    "forgerMaxRequestTokens" INTEGER NOT NULL DEFAULT 6000,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "AppInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "userEmail" TEXT,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'web',
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteCommand" (
    "id" TEXT NOT NULL,
    "targetDeviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "RemoteCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalloonAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalloonAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlOpportunity" (
    "id" TEXT NOT NULL,
    "ghlId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "monetaryValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlBookedContact" (
    "id" TEXT NOT NULL,
    "ghlId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhlBookedContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlAppointment" (
    "id" TEXT NOT NULL,
    "ghlId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "calendarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookedAppointment" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "ghlId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookedAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingKeyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "maxLeads" INTEGER NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "extraKeywords" TEXT[],
    "extraKeywordsMode" TEXT NOT NULL DEFAULT 'random',
    "extraKeywordsMin" INTEGER NOT NULL DEFAULT 1,
    "extraKeywordsMax" INTEGER NOT NULL DEFAULT 3,
    "extraKeywordsIndex" INTEGER NOT NULL DEFAULT 0,
    "extraKeywordsOrder" TEXT[],
    "category" TEXT NOT NULL DEFAULT 'Uncategorized',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityIndex" INTEGER NOT NULL DEFAULT 0,
    "cityRotationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "grabEmail" BOOLEAN NOT NULL DEFAULT false,
    "autoRun" BOOLEAN NOT NULL DEFAULT false,
    "autoRunStartedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapingKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "milestoneTarget" INTEGER,
    "period" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEarning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "CommissionEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCommission" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "ruleId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepCommission" (
    "id" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "ruleId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "earnedAt" TIMESTAMP(3),
    "earnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "content" JSONB NOT NULL DEFAULT '{}',
    "userId" TEXT NOT NULL,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteFile" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Script',
    "content" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptFile" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Industry_userId_idx" ON "Industry"("userId");

-- CreateIndex
CREATE INDEX "CategoryAccess_userId_idx" ON "CategoryAccess"("userId");

-- CreateIndex
CREATE INDEX "CategoryAccess_industryId_idx" ON "CategoryAccess"("industryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAccess_userId_industryId_key" ON "CategoryAccess"("userId", "industryId");

-- CreateIndex
CREATE INDEX "Subcategory_userId_idx" ON "Subcategory"("userId");

-- CreateIndex
CREATE INDEX "Subcategory_industryId_idx" ON "Subcategory"("industryId");

-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

-- CreateIndex
CREATE INDEX "Folder_industryId_idx" ON "Folder"("industryId");

-- CreateIndex
CREATE INDEX "Folder_subcategoryId_idx" ON "Folder"("subcategoryId");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_website_idx" ON "Lead"("website");

-- CreateIndex
CREATE INDEX "Lead_city_state_idx" ON "Lead"("city", "state");

-- CreateIndex
CREATE INDEX "Lead_folderId_idx" ON "Lead"("folderId");

-- CreateIndex
CREATE INDEX "Lead_savedById_idx" ON "Lead"("savedById");

-- CreateIndex
CREATE INDEX "Lead_keywordId_idx" ON "Lead"("keywordId");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "Lead_exportedAt_idx" ON "Lead"("exportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_ghlUserId_key" ON "User"("ghlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Balloon_position_key" ON "Balloon"("position");

-- CreateIndex
CREATE INDEX "Balloon_position_idx" ON "Balloon"("position");

-- CreateIndex
CREATE INDEX "Balloon_poppedById_idx" ON "Balloon"("poppedById");

-- CreateIndex
CREATE INDEX "Balloon_paidById_idx" ON "Balloon"("paidById");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_ghlMessageId_key" ON "CallLog"("ghlMessageId");

-- CreateIndex
CREATE INDEX "CallLog_agentId_idx" ON "CallLog"("agentId");

-- CreateIndex
CREATE INDEX "CallLog_calledAt_idx" ON "CallLog"("calledAt");

-- CreateIndex
CREATE INDEX "CallLog_leadId_idx" ON "CallLog"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "MarketingTask_createdById_idx" ON "MarketingTask"("createdById");

-- CreateIndex
CREATE INDEX "TaskProgress_userId_idx" ON "TaskProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskProgress_userId_taskId_key" ON "TaskProgress"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "FeedbackReport_submittedBy_idx" ON "FeedbackReport"("submittedBy");

-- CreateIndex
CREATE INDEX "FeedbackReport_status_idx" ON "FeedbackReport"("status");

-- CreateIndex
CREATE INDEX "FeedbackComment_reportId_idx" ON "FeedbackComment"("reportId");

-- CreateIndex
CREATE INDEX "FeedbackComment_authorId_idx" ON "FeedbackComment"("authorId");

-- CreateIndex
CREATE INDEX "KanbanTask_column_idx" ON "KanbanTask"("column");

-- CreateIndex
CREATE INDEX "KanbanTask_createdById_idx" ON "KanbanTask"("createdById");

-- CreateIndex
CREATE INDEX "KanbanTask_assigneeId_idx" ON "KanbanTask"("assigneeId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_idx" ON "CalendarEvent"("startDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdById_idx" ON "CalendarEvent"("createdById");

-- CreateIndex
CREATE INDEX "KanbanComment_taskId_idx" ON "KanbanComment"("taskId");

-- CreateIndex
CREATE INDEX "KanbanComment_authorId_idx" ON "KanbanComment"("authorId");

-- CreateIndex
CREATE INDEX "DbNotification_userId_idx" ON "DbNotification"("userId");

-- CreateIndex
CREATE INDEX "DbNotification_userId_read_idx" ON "DbNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "ChatRoom_createdById_idx" ON "ChatRoom"("createdById");

-- CreateIndex
CREATE INDEX "ChatRoomMember_roomId_idx" ON "ChatRoomMember"("roomId");

-- CreateIndex
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_idx" ON "ChatMessage"("roomId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ScrapingJob_status_idx" ON "ScrapingJob"("status");

-- CreateIndex
CREATE INDEX "ScrapingJob_createdAt_idx" ON "ScrapingJob"("createdAt");

-- CreateIndex
CREATE INDEX "ScrapingJob_keywordId_idx" ON "ScrapingJob"("keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_reportsShareToken_key" ON "AppSettings"("reportsShareToken");

-- CreateIndex
CREATE INDEX "ForgerConversation_userId_idx" ON "ForgerConversation"("userId");

-- CreateIndex
CREATE INDEX "ForgerMessage_conversationId_idx" ON "ForgerMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AppInstance_lastSeen_idx" ON "AppInstance"("lastSeen");

-- CreateIndex
CREATE INDEX "AppInstance_userId_idx" ON "AppInstance"("userId");

-- CreateIndex
CREATE INDEX "RemoteCommand_targetDeviceId_status_idx" ON "RemoteCommand"("targetDeviceId", "status");

-- CreateIndex
CREATE INDEX "BalloonAuditLog_actorId_idx" ON "BalloonAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "BalloonAuditLog_createdAt_idx" ON "BalloonAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GhlOpportunity_ghlId_key" ON "GhlOpportunity"("ghlId");

-- CreateIndex
CREATE INDEX "GhlOpportunity_agentId_idx" ON "GhlOpportunity"("agentId");

-- CreateIndex
CREATE INDEX "GhlOpportunity_status_idx" ON "GhlOpportunity"("status");

-- CreateIndex
CREATE INDEX "GhlOpportunity_createdAt_idx" ON "GhlOpportunity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GhlBookedContact_ghlId_key" ON "GhlBookedContact"("ghlId");

-- CreateIndex
CREATE INDEX "GhlBookedContact_agentId_idx" ON "GhlBookedContact"("agentId");

-- CreateIndex
CREATE INDEX "GhlBookedContact_createdAt_idx" ON "GhlBookedContact"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GhlAppointment_ghlId_key" ON "GhlAppointment"("ghlId");

-- CreateIndex
CREATE INDEX "GhlAppointment_agentId_idx" ON "GhlAppointment"("agentId");

-- CreateIndex
CREATE INDEX "GhlAppointment_status_idx" ON "GhlAppointment"("status");

-- CreateIndex
CREATE INDEX "GhlAppointment_startTime_idx" ON "GhlAppointment"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "BookedAppointment_ghlId_key" ON "BookedAppointment"("ghlId");

-- CreateIndex
CREATE INDEX "BookedAppointment_agentId_idx" ON "BookedAppointment"("agentId");

-- CreateIndex
CREATE INDEX "BookedAppointment_bookedAt_idx" ON "BookedAppointment"("bookedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookedAppointment_clientPhone_bookedAt_key" ON "BookedAppointment"("clientPhone", "bookedAt");

-- CreateIndex
CREATE INDEX "ScrapingKeyword_enabled_nextRunAt_idx" ON "ScrapingKeyword"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "ScrapingKeyword_createdById_idx" ON "ScrapingKeyword"("createdById");

-- CreateIndex
CREATE INDEX "KeywordAccess_userId_idx" ON "KeywordAccess"("userId");

-- CreateIndex
CREATE INDEX "KeywordAccess_keywordId_idx" ON "KeywordAccess"("keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordAccess_userId_keywordId_key" ON "KeywordAccess"("userId", "keywordId");

-- CreateIndex
CREATE INDEX "CommissionEarning_userId_idx" ON "CommissionEarning"("userId");

-- CreateIndex
CREATE INDEX "CommissionEarning_ruleId_idx" ON "CommissionEarning"("ruleId");

-- CreateIndex
CREATE INDEX "CommissionEarning_period_idx" ON "CommissionEarning"("period");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEarning_userId_ruleId_period_key" ON "CommissionEarning"("userId", "ruleId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCommission_leadId_key" ON "LeadCommission"("leadId");

-- CreateIndex
CREATE INDEX "LeadCommission_agentId_idx" ON "LeadCommission"("agentId");

-- CreateIndex
CREATE INDEX "LeadCommission_status_idx" ON "LeadCommission"("status");

-- CreateIndex
CREATE INDEX "LeadCommission_paidById_idx" ON "LeadCommission"("paidById");

-- CreateIndex
CREATE INDEX "RepCommission_repId_idx" ON "RepCommission"("repId");

-- CreateIndex
CREATE INDEX "RepCommission_status_idx" ON "RepCommission"("status");

-- CreateIndex
CREATE INDEX "RepCommission_earnedById_idx" ON "RepCommission"("earnedById");

-- CreateIndex
CREATE UNIQUE INDEX "Note_shareToken_key" ON "Note"("shareToken");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "NoteFile_noteId_idx" ON "NoteFile"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "Script_shareToken_key" ON "Script"("shareToken");

-- CreateIndex
CREATE INDEX "Script_createdById_idx" ON "Script"("createdById");

-- CreateIndex
CREATE INDEX "ScriptFile_scriptId_idx" ON "ScriptFile"("scriptId");

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAccess" ADD CONSTRAINT "CategoryAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAccess" ADD CONSTRAINT "CategoryAccess_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "ScrapingKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balloon" ADD CONSTRAINT "Balloon_poppedById_fkey" FOREIGN KEY ("poppedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balloon" ADD CONSTRAINT "Balloon_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProgress" ADD CONSTRAINT "TaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProgress" ADD CONSTRAINT "TaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FeedbackReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanComment" ADD CONSTRAINT "KanbanComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanComment" ADD CONSTRAINT "KanbanComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DbNotification" ADD CONSTRAINT "DbNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "ScrapingKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForgerMessage" ADD CONSTRAINT "ForgerMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ForgerConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalloonAuditLog" ADD CONSTRAINT "BalloonAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlOpportunity" ADD CONSTRAINT "GhlOpportunity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlOpportunity" ADD CONSTRAINT "GhlOpportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlBookedContact" ADD CONSTRAINT "GhlBookedContact_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlAppointment" ADD CONSTRAINT "GhlAppointment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlAppointment" ADD CONSTRAINT "GhlAppointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookedAppointment" ADD CONSTRAINT "BookedAppointment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookedAppointment" ADD CONSTRAINT "BookedAppointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingKeyword" ADD CONSTRAINT "ScrapingKeyword_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordAccess" ADD CONSTRAINT "KeywordAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordAccess" ADD CONSTRAINT "KeywordAccess_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "ScrapingKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCommission" ADD CONSTRAINT "LeadCommission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCommission" ADD CONSTRAINT "LeadCommission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCommission" ADD CONSTRAINT "LeadCommission_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCommission" ADD CONSTRAINT "LeadCommission_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_earnedById_fkey" FOREIGN KEY ("earnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteFile" ADD CONSTRAINT "NoteFile_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptFile" ADD CONSTRAINT "ScriptFile_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Lead dedup indexes (see prisma/migrations/20260825000000_add_lead_dedup_indexes)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Functional index on the business-name key.
--    Serves the name half of checkDuplicate(). Not UNIQUE on purpose: directory scrapes
--    legitimately yield many leads sharing one site-derived name, and a hard constraint
--    would permanently reject a genuinely different business with a colliding name.
--    checkDuplicate() merges those instead, which keeps the guarantee without the
--    false-positive risk.
CREATE INDEX IF NOT EXISTS "Lead_business_name_key_idx"
  ON "Lead" (lower(btrim("businessName")));

-- 2. Unique index on the normalized phone number.
--    Phone is the reliable key, so this one is hard-enforced: it closes the concurrent
--    insert race that checkDuplicate() alone cannot (it reads only committed rows).
--    insertLead() catches the resulting P2002 and reports a duplicate.
--    The expression mirrors normalizePhone() in src/lib/utils/normalize.ts: digits only,
--    meaningful at 7+ digits. Leads with no usable phone (stored as "" or "N/A") are
--    excluded by the WHERE clause, so any number of them can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_phone_normalized_key"
  ON "Lead" ((regexp_replace("phone", '\D', '', 'g')))
  WHERE length(regexp_replace("phone", '\D', '', 'g')) >= 7;
