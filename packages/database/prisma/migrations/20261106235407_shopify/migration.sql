-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'UNINSTALLED');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('OPEN', 'ABANDONED', 'RECOVERED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'shopify',
    "shopDomain" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "accessTokenEnc" TEXT,
    "scopes" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "pixelKey" TEXT NOT NULL,
    "webPixelId" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOAuthState" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopifyOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "visitorId" TEXT,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "data" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "checkoutToken" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "customerId" TEXT,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "recoveryUrl" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'OPEN',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "checkoutToken" TEXT,
    "email" TEXT,
    "customerId" TEXT,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_shopDomain_key" ON "Store"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Store_pixelKey_key" ON "Store"("pixelKey");

-- CreateIndex
CREATE INDEX "Store_organizationId_idx" ON "Store"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOAuthState_nonce_key" ON "ShopifyOAuthState"("nonce");

-- CreateIndex
CREATE INDEX "Visitor_storeId_lastSeen_idx" ON "Visitor"("storeId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_storeId_clientId_key" ON "Visitor"("storeId", "clientId");

-- CreateIndex
CREATE INDEX "Event_storeId_occurredAt_idx" ON "Event"("storeId", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_storeId_name_occurredAt_idx" ON "Event"("storeId", "name", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_storeId_externalId_key" ON "Event"("storeId", "externalId");

-- CreateIndex
CREATE INDEX "Cart_storeId_status_updatedAt_idx" ON "Cart"("storeId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Cart_storeId_email_idx" ON "Cart"("storeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_storeId_checkoutToken_key" ON "Cart"("storeId", "checkoutToken");

-- CreateIndex
CREATE INDEX "Order_storeId_orderedAt_idx" ON "Order"("storeId", "orderedAt");

-- CreateIndex
CREATE INDEX "Order_storeId_email_idx" ON "Order"("storeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_storeId_shopifyOrderId_key" ON "Order"("storeId", "shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookReceipt_webhookId_key" ON "WebhookReceipt"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookReceipt_shopDomain_receivedAt_idx" ON "WebhookReceipt"("shopDomain", "receivedAt");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
