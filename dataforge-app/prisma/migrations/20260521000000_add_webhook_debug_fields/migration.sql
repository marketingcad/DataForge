-- Add webhook debug fields to AppSettings for diagnosing inbound webhook payloads
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "webhookLastPayload" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "webhookLastOutcome" TEXT;
