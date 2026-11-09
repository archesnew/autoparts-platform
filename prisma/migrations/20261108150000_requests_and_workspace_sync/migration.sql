-- AlterTable
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "vehicle_make" TEXT,
ADD COLUMN IF NOT EXISTS "vehicle_model" TEXT,
ADD COLUMN IF NOT EXISTS "vehicle_year" TEXT,
ADD COLUMN IF NOT EXISTS "vehicle_vin" TEXT,
ADD COLUMN IF NOT EXISTS "manager_name_snapshot" TEXT,
ADD COLUMN IF NOT EXISTS "customer_offer_status" "CustomerOfferStatus",
ADD COLUMN IF NOT EXISTS "customer_response_status" TEXT;

-- AlterTable
ALTER TABLE "supplier_quotes" ADD COLUMN IF NOT EXISTS "shipping_basis" TEXT DEFAULT 'ORDER';

-- AlterTable
ALTER TABLE "customer_offers" ADD COLUMN IF NOT EXISTS "shared_logistics_rub" DECIMAL(18,4),
ADD COLUMN IF NOT EXISTS "response_status" TEXT DEFAULT 'NO_RESPONSE',
ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "snapshot" JSONB;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'NORMAL';
