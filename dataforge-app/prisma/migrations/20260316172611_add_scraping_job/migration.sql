-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'paused');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('serpapi', 'manual');

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
    "startTime" TIMESTAMP(3),
    "completedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapingJob_status_idx" ON "ScrapingJob"("status");

-- CreateIndex
CREATE INDEX "ScrapingJob_createdAt_idx" ON "ScrapingJob"("createdAt");
