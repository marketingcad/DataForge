-- CreateTable
CREATE TABLE "RepCommission" (
    "id"         TEXT NOT NULL,
    "repId"      TEXT NOT NULL,
    "ruleId"     TEXT,
    "amount"     DOUBLE PRECISION NOT NULL,
    "note"       TEXT,
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "earnedAt"   TIMESTAMP(3),
    "earnedById" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepCommission_repId_idx" ON "RepCommission"("repId");
CREATE INDEX "RepCommission_status_idx" ON "RepCommission"("status");
CREATE INDEX "RepCommission_earnedById_idx" ON "RepCommission"("earnedById");

-- AddForeignKey
ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_repId_fkey"
    FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_earnedById_fkey"
    FOREIGN KEY ("earnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
