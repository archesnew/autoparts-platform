-- Seed CUSTOMER into staff_roles so User.role can reference it
INSERT INTO "staff_roles" ("code", "name", "isSystem", "updatedAt")
VALUES ('CUSTOMER', 'Покупатель', true, NOW())
ON CONFLICT ("code") DO NOTHING;

-- Add user_id to customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "user_id" UUID;

DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_key" UNIQUE ("user_id");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create customer_vehicles table
CREATE TABLE IF NOT EXISTS "customer_vehicles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "generation" TEXT,
  "year" INTEGER,
  "modification" TEXT,
  "vin" TEXT NOT NULL,
  "engine" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "customer_vehicles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_vehicles_customer_id_idx" ON "customer_vehicles"("customer_id");
CREATE INDEX IF NOT EXISTS "customer_vehicles_vin_idx" ON "customer_vehicles"("vin");

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "recipient_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Россия',
  "city" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "house" TEXT NOT NULL,
  "apartment" TEXT,
  "postal_code" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- Add photos column to request_items
ALTER TABLE "request_items" ADD COLUMN IF NOT EXISTS "photos" JSONB;
