CREATE TABLE "BookedAppointment" (
    "id"          TEXT NOT NULL,
    "agentId"     TEXT NOT NULL,
    "clientName"  TEXT NOT NULL,
    "bookedAt"    TIMESTAMP(3) NOT NULL,
    "source"      TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "ghlId"       TEXT,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookedAppointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookedAppointment_ghlId_key" ON "BookedAppointment"("ghlId");
CREATE INDEX "BookedAppointment_agentId_idx" ON "BookedAppointment"("agentId");
CREATE INDEX "BookedAppointment_bookedAt_idx" ON "BookedAppointment"("bookedAt");

ALTER TABLE "BookedAppointment" ADD CONSTRAINT "BookedAppointment_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookedAppointment" ADD CONSTRAINT "BookedAppointment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
