-- Rename intervalHours → intervalMinutes and convert existing values (× 60)
ALTER TABLE "ScrapingKeyword" ADD COLUMN "intervalMinutes" INTEGER NOT NULL DEFAULT 1440;
UPDATE "ScrapingKeyword" SET "intervalMinutes" = "intervalHours" * 60;
ALTER TABLE "ScrapingKeyword" DROP COLUMN "intervalHours";
