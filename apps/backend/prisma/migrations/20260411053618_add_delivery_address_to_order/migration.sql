-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "isDelivery" BOOLEAN NOT NULL DEFAULT false;
