-- True North Field OS initial PostgreSQL schema.

CREATE TABLE "employees" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_credentials" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_logs" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "street" TEXT NOT NULL,
  "city" TEXT NOT NULL DEFAULT 'Mount Vernon',
  "state" TEXT NOT NULL DEFAULT 'OH',
  "zip" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'door_knock',
  "territory" TEXT NOT NULL DEFAULT 'Knox County',
  "notes" TEXT NOT NULL DEFAULT '',
  "stage" TEXT NOT NULL DEFAULT 'new',
  "nextAction" TEXT NOT NULL DEFAULT 'Initial contact and inspection scheduling',
  "verifiedArea" DOUBLE PRECISION,
  "pitch" DOUBLE PRECISION,
  "contractFile" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appointments" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'no',
  "appointmentDate" TIMESTAMP(3),
  "notes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "photo_assets" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "address" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'roof',
  "dataUrl" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "photo_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "estimates" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "property" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '',
  "area" DOUBLE PRECISION NOT NULL,
  "squares" DOUBLE PRECISION NOT NULL,
  "wastePct" DOUBLE PRECISION NOT NULL DEFAULT 12,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "shinglePerSq" DOUBLE PRECISION NOT NULL,
  "profileName" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "directCost" DOUBLE PRECISION NOT NULL,
  "grossProfit" DOUBLE PRECISION NOT NULL,
  "grossMarginPct" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jobs" (
  "id" TEXT NOT NULL,
  "estimateId" TEXT,
  "leadId" TEXT,
  "property" TEXT NOT NULL,
  "contractValue" DOUBLE PRECISION NOT NULL,
  "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cashCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contractFilename" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "startDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pricing_profiles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "materialPerSq" DOUBLE PRECISION NOT NULL,
  "laborPerSq" DOUBLE PRECISION NOT NULL,
  "tearOffPerSq" DOUBLE PRECISION NOT NULL,
  "underlaymentPerSq" DOUBLE PRECISION NOT NULL,
  "accessoriesPerSq" DOUBLE PRECISION NOT NULL,
  "disposalPerJob" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "permitPerJob" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salesCommissionPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "targetGrossMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 35,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pricing_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_prices" (
  "id" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '',
  "price" DOUBLE PRECISION NOT NULL,
  "supplier" TEXT NOT NULL,
  "item" TEXT NOT NULL DEFAULT '',
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inspection_reports" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "photoDataUrl" TEXT NOT NULL,
  "windCount" INTEGER NOT NULL DEFAULT 0,
  "hailCount" INTEGER NOT NULL DEFAULT 0,
  "missingCount" INTEGER NOT NULL DEFAULT 0,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "recommendedIko" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'AI Vision (VLM)',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspection_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copilot_messages" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canvass_routes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "town" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT NOT NULL DEFAULT '',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "canvass_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canvass_stops" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "leadId" TEXT,
  "street" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "order" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT NOT NULL DEFAULT '',
  "visitedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canvass_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aerial_scans" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "address" TEXT NOT NULL,
  "conditionScore" INTEGER NOT NULL DEFAULT 0,
  "condition" TEXT NOT NULL DEFAULT 'unknown',
  "findings" TEXT NOT NULL DEFAULT '',
  "indicators" TEXT NOT NULL DEFAULT '[]',
  "imageDataUrl" TEXT NOT NULL DEFAULT '',
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aerial_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_credentials_role_key" ON "access_credentials"("role");
CREATE INDEX "employees_role_idx" ON "employees"("role");
CREATE INDEX "employees_active_idx" ON "employees"("active");
CREATE INDEX "activity_logs_employeeId_createdAt_idx" ON "activity_logs"("employeeId", "createdAt");
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
CREATE INDEX "leads_street_idx" ON "leads"("street");
CREATE INDEX "leads_stage_idx" ON "leads"("stage");
CREATE INDEX "leads_createdById_idx" ON "leads"("createdById");
CREATE INDEX "appointments_leadId_createdAt_idx" ON "appointments"("leadId", "createdAt");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");
CREATE INDEX "photo_assets_leadId_createdAt_idx" ON "photo_assets"("leadId", "createdAt");
CREATE INDEX "photo_assets_address_idx" ON "photo_assets"("address");
CREATE INDEX "estimates_leadId_idx" ON "estimates"("leadId");
CREATE INDEX "estimates_createdById_idx" ON "estimates"("createdById");
CREATE INDEX "jobs_leadId_idx" ON "jobs"("leadId");
CREATE INDEX "jobs_createdById_idx" ON "jobs"("createdById");
CREATE INDEX "supplier_prices_product_color_savedAt_idx" ON "supplier_prices"("product", "color", "savedAt");
CREATE INDEX "inspection_reports_leadId_createdAt_idx" ON "inspection_reports"("leadId", "createdAt");
CREATE INDEX "copilot_messages_createdAt_idx" ON "copilot_messages"("createdAt");
CREATE INDEX "canvass_routes_status_createdAt_idx" ON "canvass_routes"("status", "createdAt");
CREATE INDEX "canvass_stops_routeId_order_idx" ON "canvass_stops"("routeId", "order");
CREATE INDEX "canvass_stops_leadId_idx" ON "canvass_stops"("leadId");
CREATE INDEX "aerial_scans_leadId_scannedAt_idx" ON "aerial_scans"("leadId", "scannedAt");

ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "photo_assets" ADD CONSTRAINT "photo_assets_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "photo_assets" ADD CONSTRAINT "photo_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "canvass_stops" ADD CONSTRAINT "canvass_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "canvass_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aerial_scans" ADD CONSTRAINT "aerial_scans_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
