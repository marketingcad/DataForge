-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "savedById" TEXT;

-- CreateIndex
CREATE INDEX "Lead_savedById_idx" ON "Lead"("savedById");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_savedById_fkey"
  FOREIGN KEY ("savedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
