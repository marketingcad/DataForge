ALTER TABLE "BookedAppointment" ADD COLUMN "clientPhone" TEXT;
CREATE UNIQUE INDEX "BookedAppointment_clientPhone_bookedAt_key" ON "BookedAppointment"("clientPhone", "bookedAt");
