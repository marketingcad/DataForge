-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'flagged', 'invalid');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "contactPerson" TEXT,
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

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_website_idx" ON "Lead"("website");

-- CreateIndex
CREATE INDEX "Lead_city_state_idx" ON "Lead"("city", "state");
