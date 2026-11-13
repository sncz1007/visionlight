-- CreateEnum
CREATE TYPE "RecoveryEmailStatus" AS ENUM ('SENT', 'DRY_RUN', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "abandonedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "recoveryDelayMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "recoveryEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RecoveryEmail" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "status" "RecoveryEmailStatus" NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unsubscribe" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unsubscribe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryEmail_cartId_key" ON "RecoveryEmail"("cartId");

-- CreateIndex
CREATE INDEX "RecoveryEmail_storeId_emailHash_sentAt_idx" ON "RecoveryEmail"("storeId", "emailHash", "sentAt");

-- CreateIndex
CREATE INDEX "RecoveryEmail_storeId_status_sentAt_idx" ON "RecoveryEmail"("storeId", "status", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Unsubscribe_storeId_emailHash_key" ON "Unsubscribe"("storeId", "emailHash");

-- AddForeignKey
ALTER TABLE "RecoveryEmail" ADD CONSTRAINT "RecoveryEmail_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryEmail" ADD CONSTRAINT "RecoveryEmail_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unsubscribe" ADD CONSTRAINT "Unsubscribe_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
