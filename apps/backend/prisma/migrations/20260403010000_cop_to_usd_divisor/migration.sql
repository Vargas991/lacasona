ALTER TABLE "DashboardSettings"
RENAME COLUMN "copToUsdMultiplier" TO "copToUsdDivisor";

UPDATE "DashboardSettings"
SET "copToUsdDivisor" = CASE
  WHEN "copToUsdDivisor" = 0 THEN 3600
  ELSE ROUND((1 / "copToUsdDivisor")::numeric, 4)
END;
