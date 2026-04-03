-- CreateTable
CREATE TABLE "DailyCounter" (
    "dateKey" TEXT NOT NULL,
    "lastOrderNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCounter_pkey" PRIMARY KEY ("dateKey")
);

-- Add nullable columns first for safe backfill
ALTER TABLE "Order" ADD COLUMN "dateKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "dailySequence" INTEGER;

-- Backfill existing rows with YYYYMMDD + daily sequence by creation time
WITH ranked_orders AS (
    SELECT
        o."id",
        to_char(o."createdAt", 'YYYYMMDD') AS date_key,
        row_number() OVER (
            PARTITION BY to_char(o."createdAt", 'YYYYMMDD')
            ORDER BY o."createdAt" ASC, o."id" ASC
        ) AS seq
    FROM "Order" o
)
UPDATE "Order" o
SET
    "dateKey" = r.date_key,
    "dailySequence" = r.seq
FROM ranked_orders r
WHERE o."id" = r."id";

-- Seed daily counters using the max sequence used in each day
INSERT INTO "DailyCounter" ("dateKey", "lastOrderNumber", "createdAt", "updatedAt")
SELECT
    o."dateKey",
    MAX(o."dailySequence") AS "lastOrderNumber",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."dateKey" IS NOT NULL
GROUP BY o."dateKey"
ON CONFLICT ("dateKey") DO UPDATE
SET
    "lastOrderNumber" = EXCLUDED."lastOrderNumber",
    "updatedAt" = CURRENT_TIMESTAMP;

-- Enforce required columns after backfill
ALTER TABLE "Order" ALTER COLUMN "dateKey" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "dailySequence" SET NOT NULL;

-- Add unique composite key for per-day numbering
CREATE UNIQUE INDEX "Order_dateKey_dailySequence_key" ON "Order"("dateKey", "dailySequence");
