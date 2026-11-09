-- Safe additive migration for Supplier Portal, Supplier Users, and Invitations

-- AlterEnum SupplierStatus
DO $$ BEGIN
    ALTER TYPE "SupplierStatus" ADD VALUE IF NOT EXISTS 'PENDING';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "SupplierStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum SupplierUserRole
DO $$ BEGIN
    CREATE TYPE "SupplierUserRole" AS ENUM ('OWNER', 'MANAGER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum SupplierUserStatus
DO $$ BEGIN
    CREATE TYPE "SupplierUserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum InvitationStatus
DO $$ BEGIN
    CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "legal_name" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "inn_or_vat" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "warehouse_address" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "delivery_methods" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "pickup_available" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "order_processing_days" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "supported_currencies" TEXT[] DEFAULT ARRAY['RUB']::TEXT[];

-- CreateTable supplier_users
CREATE TABLE IF NOT EXISTS "supplier_users" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "SupplierUserRole" NOT NULL DEFAULT 'MANAGER',
    "status" "SupplierUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable supplier_invitations
CREATE TABLE IF NOT EXISTS "supplier_invitations" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SupplierUserRole" NOT NULL DEFAULT 'MANAGER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invitations_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_users_user_id_key" ON "supplier_users"("user_id");
CREATE INDEX IF NOT EXISTS "supplier_users_supplier_id_status_idx" ON "supplier_users"("supplier_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invitations_token_key" ON "supplier_invitations"("token");
CREATE INDEX IF NOT EXISTS "supplier_invitations_supplier_id_status_idx" ON "supplier_invitations"("supplier_id", "status");

-- Foreign Keys
DO $$ BEGIN
    ALTER TABLE "supplier_users" ADD CONSTRAINT "supplier_users_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_users" ADD CONSTRAINT "supplier_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_invitations" ADD CONSTRAINT "supplier_invitations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Register SUPPLIER role in staff_roles (with 0 staff permissions)
INSERT INTO "staff_roles" ("code", "name", "isSystem", "updatedAt")
VALUES ('SUPPLIER', 'Представитель поставщика', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
