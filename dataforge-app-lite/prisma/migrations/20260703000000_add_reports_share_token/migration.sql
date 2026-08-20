-- Public shareable-link token for the Reports agent performance matrix
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "reportsShareToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_reportsShareToken_key" ON "AppSettings"("reportsShareToken");
