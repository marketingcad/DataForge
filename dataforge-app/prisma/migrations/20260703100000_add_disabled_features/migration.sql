-- Boss-controlled feature toggles: list of disabled feature keys
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "disabledFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
