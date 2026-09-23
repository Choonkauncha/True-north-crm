ALTER TABLE "leads" ADD COLUMN "geocodeAccuracy" DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN "geocodeAccuracyType" TEXT;
ALTER TABLE "leads" ADD COLUMN "stableAddressKey" TEXT;
CREATE INDEX "leads_stableAddressKey_idx" ON "leads"("stableAddressKey");
