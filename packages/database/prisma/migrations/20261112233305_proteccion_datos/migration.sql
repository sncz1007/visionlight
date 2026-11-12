/*
  Warnings:

  - You are about to drop the column `email` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Visitor` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Cart_storeId_email_idx";

-- DropIndex
DROP INDEX "Order_storeId_email_idx";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "email",
DROP COLUMN "phone",
ADD COLUMN     "emailEnc" TEXT,
ADD COLUMN     "emailHash" TEXT,
ADD COLUMN     "phoneEnc" TEXT;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "email",
ADD COLUMN     "emailEnc" TEXT,
ADD COLUMN     "emailHash" TEXT;

-- AlterTable
ALTER TABLE "Visitor" DROP COLUMN "email",
ADD COLUMN     "emailEnc" TEXT,
ADD COLUMN     "emailHash" TEXT;

-- CreateIndex
CREATE INDEX "Cart_storeId_emailHash_idx" ON "Cart"("storeId", "emailHash");

-- CreateIndex
CREATE INDEX "Order_storeId_emailHash_idx" ON "Order"("storeId", "emailHash");
