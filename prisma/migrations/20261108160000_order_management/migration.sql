-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PENDING_PAYMENT', 'PAID', 'PENDING_PROCUREMENT', 'IN_FULFILLMENT', 'READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PROCUREMENT', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DISPATCH_PREPARED', 'IN_TRANSIT', 'AT_PICKUP_POINT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderDocumentType" AS ENUM ('INVOICE', 'WAYBILL', 'DISPATCH_NOTE', 'PACKING_LIST', 'RECEIPT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "orderId" UUID;

-- AlterTable activity_log
ALTER TABLE "activity_log" ADD COLUMN IF NOT EXISTS "orderId" UUID;

-- CreateTable orders
CREATE TABLE IF NOT EXISTS "orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "request_id" UUID,
    "customer_id" UUID NOT NULL,
    "assigned_manager_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'CRM',
    "country" TEXT NOT NULL DEFAULT 'Россия',
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "logistics_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(18,4) NOT NULL,
    "customer_comment" TEXT,
    "internal_comment" TEXT,
    "rejection_reason" TEXT,
    "logistics_instructions" TEXT,
    "financial_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable order_items
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "requested_part_number" TEXT,
    "name_on_purchase" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT,
    "supplier_offer_id" UUID,
    "supplier_id" UUID,
    "purchase_price" DECIMAL(18,4) NOT NULL,
    "purchase_currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "fx_rate" TEXT NOT NULL DEFAULT '1',
    "supplier_logistics_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "markup" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(18,4) NOT NULL,
    "total_amount" DECIMAL(18,4) NOT NULL,
    "gross_profit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "financial_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable payments
CREATE TABLE IF NOT EXISTS "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "payment_method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "external_payment_id" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "history" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable shipments
CREATE TABLE IF NOT EXISTS "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "carrier" TEXT NOT NULL DEFAULT 'CDEK',
    "tariff" TEXT,
    "delivery_method" TEXT NOT NULL DEFAULT 'PICKUP_POINT',
    "city" TEXT,
    "address" TEXT,
    "postal_code" TEXT,
    "pickup_point_id" TEXT,
    "tracking_number" TEXT,
    "cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "estimated_days" INTEGER,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_history" JSONB,
    "dispatched_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable order_documents
CREATE TABLE IF NOT EXISTS "order_documents" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "document_type" "OrderDocumentType" NOT NULL DEFAULT 'INVOICE',
    "document_number" TEXT NOT NULL,
    "file_url" TEXT,
    "content_json" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable order_messages
CREATE TABLE IF NOT EXISTS "order_messages" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sender_type" TEXT NOT NULL DEFAULT 'STAFF',
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_messages_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key" ON "orders"("order_number");
CREATE INDEX IF NOT EXISTS "orders_customer_id_status_idx" ON "orders"("customer_id", "status");
CREATE INDEX IF NOT EXISTS "orders_assigned_manager_id_status_idx" ON "orders"("assigned_manager_id", "status");
CREATE INDEX IF NOT EXISTS "orders_status_payment_status_delivery_status_idx" ON "orders"("status", "payment_status", "delivery_status");
CREATE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders"("order_number");

CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_requested_part_number_idx" ON "order_items"("requested_part_number");

CREATE INDEX IF NOT EXISTS "payments_order_id_status_idx" ON "payments"("order_id", "status");

CREATE INDEX IF NOT EXISTS "shipments_order_id_status_idx" ON "shipments"("order_id", "status");
CREATE INDEX IF NOT EXISTS "shipments_tracking_number_idx" ON "shipments"("tracking_number");

CREATE INDEX IF NOT EXISTS "order_documents_order_id_document_type_idx" ON "order_documents"("order_id", "document_type");

CREATE INDEX IF NOT EXISTS "order_messages_order_id_is_internal_idx" ON "order_messages"("order_id", "is_internal");

CREATE INDEX IF NOT EXISTS "tasks_orderId_status_idx" ON "tasks"("orderId", "status");
CREATE INDEX IF NOT EXISTS "activity_log_orderId_occurredAt_idx" ON "activity_log"("orderId", "occurredAt");

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_manager_id_fkey" FOREIGN KEY ("assigned_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_supplier_offer_id_fkey" FOREIGN KEY ("supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Permissions
INSERT INTO "staff_permissions" ("code", "description") VALUES
  ('orders.create', 'Создание заказов из предложений'),
  ('orders.payment.manage', 'Управление платежами по заказам'),
  ('orders.shipment.manage', 'Управление отправлениями и трек-номерами')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('ADMIN', 'orders.read'),
  ('ADMIN', 'orders.create'),
  ('ADMIN', 'orders.update'),
  ('ADMIN', 'orders.payment.manage'),
  ('ADMIN', 'orders.shipment.manage'),
  ('ADMIN', 'shipments.read'),
  ('ADMIN', 'shipments.update'),
  ('ADMIN', 'logistics.documents.read'),
  ('MANAGER', 'orders.read'),
  ('MANAGER', 'orders.create'),
  ('MANAGER', 'orders.update'),
  ('MANAGER', 'orders.payment.manage'),
  ('MANAGER', 'orders.shipment.manage'),
  ('MANAGER', 'shipments.read'),
  ('MANAGER', 'shipments.update'),
  ('MANAGER', 'logistics.documents.read'),
  ('LOGISTICS', 'orders.read'),
  ('LOGISTICS', 'orders.update'),
  ('LOGISTICS', 'orders.shipment.manage'),
  ('LOGISTICS', 'shipments.read'),
  ('LOGISTICS', 'shipments.update'),
  ('LOGISTICS', 'logistics.documents.read')
ON CONFLICT DO NOTHING;
