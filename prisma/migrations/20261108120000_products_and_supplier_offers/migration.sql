-- Additive Product Catalog and Supplier Offers schema

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED_SOLD', 'DRAFT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "OfferCondition" AS ENUM ('NEW', 'USED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "OfferStatus" AS ENUM ('IN_STOCK', 'ON_REQUEST', 'OUT_OF_STOCK', 'ARCHIVED_SOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "products" (
    "id" UUID NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "primary_oem" TEXT NOT NULL,
    "oem_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alt_articles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specs" JSONB,
    "applicability" JSONB,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supplier_offers" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "original_title" TEXT NOT NULL,
    "raw_article" TEXT,
    "purchase_price" DECIMAL(18,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "OfferCondition" NOT NULL DEFAULT 'NEW',
    "status" "OfferStatus" NOT NULL DEFAULT 'IN_STOCK',
    "delivery_terms" TEXT,
    "delivery_days" INTEGER,
    "source_url" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_primary_oem_idx" ON "products"("primary_oem");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_offers_product_id_status_idx" ON "supplier_offers"("product_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_offers_supplier_id_status_idx" ON "supplier_offers"("supplier_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_offers_source_status_idx" ON "supplier_offers"("source", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_offers_raw_article_idx" ON "supplier_offers"("raw_article");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_offers_supplier_id_source_external_id_key" ON "supplier_offers"("supplier_id", "source", "external_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
