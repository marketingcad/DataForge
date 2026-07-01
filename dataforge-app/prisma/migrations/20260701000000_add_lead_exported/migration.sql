-- Track when a lead was last exported (null = never exported)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "exportedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Lead_exportedAt_idx" ON "Lead"("exportedAt");
