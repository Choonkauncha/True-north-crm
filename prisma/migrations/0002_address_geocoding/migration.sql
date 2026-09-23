ALTER TABLE "leads" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN "formattedAddress" TEXT;
ALTER TABLE "leads" ADD COLUMN "geocodeStatus" TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE "leads" ADD COLUMN "geocodeProvider" TEXT;
ALTER TABLE "leads" ADD COLUMN "geocodedAt" TIMESTAMP(3);

CREATE INDEX "leads_geocodeStatus_idx" ON "leads"("geocodeStatus");
