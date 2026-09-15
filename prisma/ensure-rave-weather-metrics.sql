CREATE TABLE IF NOT EXISTS "RaveWeatherMetric" (
  "id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "dimension" TEXT NOT NULL DEFAULT '',
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaveWeatherMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RaveWeatherMetric_day_event_dimension_key"
  ON "RaveWeatherMetric"("day", "event", "dimension");

CREATE INDEX IF NOT EXISTS "RaveWeatherMetric_day_event_idx"
  ON "RaveWeatherMetric"("day", "event");

CREATE TABLE IF NOT EXISTS "RaveWeatherShare" (
  "id" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaveWeatherShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RaveWeatherShare_expiresAt_idx"
  ON "RaveWeatherShare"("expiresAt");

ALTER TABLE "RaveWeatherShare"
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimCount" INTEGER NOT NULL DEFAULT 0;
