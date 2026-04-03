DO $$
BEGIN
  CREATE TYPE "PaymentCurrency" AS ENUM ('COP', 'BS', 'USD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "paidCurrency" "PaymentCurrency" NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "copToBsDivisorSnapshot" DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "copToUsdDivisorSnapshot" DECIMAL(12,4);

UPDATE "Payment"
SET "paidAmount" = "total"
WHERE "paidAmount" IS NULL;
