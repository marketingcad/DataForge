ALTER TABLE "GhlBookedContact" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "GhlBookedContact_createdAt_idx" ON "GhlBookedContact"("createdAt");
