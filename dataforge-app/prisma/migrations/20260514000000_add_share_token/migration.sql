-- AlterTable
ALTER TABLE "Note" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Note_shareToken_key" ON "Note"("shareToken");

-- AlterTable
ALTER TABLE "Script" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Script_shareToken_key" ON "Script"("shareToken");
