/*
  Warnings:

  - You are about to alter the column `copToUsdDivisor` on the `DashboardSettings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,8)` to `Decimal(12,4)`.

*/
-- AlterTable
ALTER TABLE "DashboardSettings" ALTER COLUMN "copToUsdDivisor" SET DATA TYPE DECIMAL(12,4);
