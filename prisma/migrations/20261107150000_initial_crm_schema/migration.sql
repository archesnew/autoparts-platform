-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'ASSIGNED', 'SEARCHING', 'WAITING_SUPPLIERS', 'OFFERS_READY', 'SENT_TO_CUSTOMER', 'WAITING_CUSTOMER', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SupplierInquiryStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupplierQuoteStatus" AS ENUM ('RECEIVED', 'SELECTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CustomerOfferStatus" AS ENUM ('DRAFT', 'FORMED', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "assignedManagerId" UUID,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "customerNameSnapshot" TEXT,
    "customerPhoneSnapshot" TEXT,
    "customerEmailSnapshot" TEXT,
    "customerComment" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_items" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "requestedPartNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "conditionPreference" TEXT,
    "compatibilityNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "specialization" TEXT,
    "terms" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'REVIEW',
    "internalNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_inquiries" (
    "id" UUID NOT NULL,
    "requestItemId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "status" "SupplierInquiryStatus" NOT NULL DEFAULT 'DRAFT',
    "responseDueAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "respondedAt" TIMESTAMPTZ(6),
    "internalComment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quotes" (
    "id" UUID NOT NULL,
    "requestItemId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "inquiryId" UUID,
    "partNumber" TEXT,
    "manufacturer" TEXT,
    "condition" TEXT,
    "purchasePrice" DECIMAL(18,4),
    "currency" CHAR(3),
    "quantityAvailable" INTEGER,
    "deliveryCost" DECIMAL(18,4),
    "deliveryCurrency" CHAR(3),
    "deliveryDays" INTEGER,
    "compatibilityNote" TEXT,
    "sourceUrl" TEXT,
    "internalComment" TEXT,
    "validUntil" TIMESTAMPTZ(6),
    "status" "SupplierQuoteStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_offers" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CustomerOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "customerNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_offer_items" (
    "id" UUID NOT NULL,
    "customerOfferId" UUID NOT NULL,
    "requestItemId" UUID NOT NULL,
    "supplierQuoteId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "customerUnitPrice" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "deliveryDays" INTEGER,
    "conditionSnapshot" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_offer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "requestId" UUID,
    "assigneeId" UUID,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMPTZ(6),
    "reminderAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "requestId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "customers_normalizedPhone_idx" ON "customers"("normalizedPhone");

-- CreateIndex
CREATE INDEX "customers_normalizedEmail_idx" ON "customers"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "requests_number_key" ON "requests"("number");

-- CreateIndex
CREATE INDEX "requests_status_priority_createdAt_idx" ON "requests"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "requests_assignedManagerId_status_idx" ON "requests"("assignedManagerId", "status");

-- CreateIndex
CREATE INDEX "requests_customerId_createdAt_idx" ON "requests"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "request_items_requestId_idx" ON "request_items"("requestId");

-- CreateIndex
CREATE INDEX "request_items_requestedPartNumber_idx" ON "request_items"("requestedPartNumber");

-- CreateIndex
CREATE INDEX "suppliers_countryCode_status_idx" ON "suppliers"("countryCode", "status");

-- CreateIndex
CREATE INDEX "supplier_inquiries_requestItemId_status_idx" ON "supplier_inquiries"("requestItemId", "status");

-- CreateIndex
CREATE INDEX "supplier_inquiries_supplierId_status_responseDueAt_idx" ON "supplier_inquiries"("supplierId", "status", "responseDueAt");

-- CreateIndex
CREATE INDEX "supplier_quotes_requestItemId_status_validUntil_idx" ON "supplier_quotes"("requestItemId", "status", "validUntil");

-- CreateIndex
CREATE INDEX "supplier_quotes_supplierId_createdAt_idx" ON "supplier_quotes"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_offers_requestId_status_idx" ON "customer_offers"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_offers_requestId_version_key" ON "customer_offers"("requestId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "customer_offer_items_customerOfferId_requestItemId_key" ON "customer_offer_items"("customerOfferId", "requestItemId");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_status_dueAt_idx" ON "tasks"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "tasks_requestId_status_idx" ON "tasks"("requestId", "status");

-- CreateIndex
CREATE INDEX "activity_log_entityType_entityId_occurredAt_idx" ON "activity_log"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "activity_log_requestId_occurredAt_idx" ON "activity_log"("requestId", "occurredAt");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_inquiries" ADD CONSTRAINT "supplier_inquiries_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_inquiries" ADD CONSTRAINT "supplier_inquiries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "supplier_inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_offers" ADD CONSTRAINT "customer_offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_offer_items" ADD CONSTRAINT "customer_offer_items_customerOfferId_fkey" FOREIGN KEY ("customerOfferId") REFERENCES "customer_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_offer_items" ADD CONSTRAINT "customer_offer_items_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_offer_items" ADD CONSTRAINT "customer_offer_items_supplierQuoteId_fkey" FOREIGN KEY ("supplierQuoteId") REFERENCES "supplier_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
