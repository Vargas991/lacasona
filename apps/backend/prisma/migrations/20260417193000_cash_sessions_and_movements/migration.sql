DO $$
BEGIN
  CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CashMovementType" AS ENUM (
    'OPENING',
    'SALE_TENDERED',
    'CHANGE_GIVEN',
    'MANUAL_INCOME',
    'EXPENSE',
    'EXCHANGE_IN',
    'EXCHANGE_OUT',
    'CLOSING_ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "cashSessionId" TEXT;

CREATE TABLE IF NOT EXISTS "CashSession" (
  "id" TEXT NOT NULL,
  "cashierId" TEXT NOT NULL,
  "closedById" TEXT,
  "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openingCurrency" "PaymentCurrency" NOT NULL,
  "openingAmount" DECIMAL(12,2) NOT NULL,
  "openingCopToBsDivisor" DECIMAL(10,4) NOT NULL,
  "openingCopToUsdDivisor" DECIMAL(12,4) NOT NULL,
  "expectedCopAtClose" DECIMAL(12,2),
  "expectedBsAtClose" DECIMAL(12,2),
  "expectedUsdAtClose" DECIMAL(12,2),
  "countedCop" DECIMAL(12,2),
  "countedBs" DECIMAL(12,2),
  "countedUsd" DECIMAL(12,2),
  "differenceCop" DECIMAL(12,2),
  "differenceBs" DECIMAL(12,2),
  "differenceUsd" DECIMAL(12,2),
  "openingNote" TEXT,
  "closingNote" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CashMovement" (
  "id" TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "tableId" TEXT,
  "orderId" TEXT,
  "paymentId" TEXT,
  "type" "CashMovementType" NOT NULL,
  "currency" "PaymentCurrency" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paymentMethod" "PaymentMethod",
  "relatedCurrency" "PaymentCurrency",
  "relatedAmount" DECIMAL(12,2),
  "copToBsDivisorSnapshot" DECIMAL(10,4),
  "copToUsdDivisorSnapshot" DECIMAL(12,4),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CashSession_cashierId_status_idx"
  ON "CashSession"("cashierId", "status");

CREATE INDEX IF NOT EXISTS "CashMovement_cashSessionId_createdAt_idx"
  ON "CashMovement"("cashSessionId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "Table"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
