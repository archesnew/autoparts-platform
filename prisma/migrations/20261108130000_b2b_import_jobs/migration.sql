-- Safe additive migration for B2B Import Jobs & Rows

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'PARSED', 'PREVIEW_READY', 'COMMITTING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'INVALID', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportMatchType" AS ENUM ('NEW_PRODUCT', 'MATCHED_EXISTING', 'AMBIGUOUS', 'DUPLICATE_IN_FEED', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_jobs" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_format" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "new_products_count" INTEGER NOT NULL DEFAULT 0,
    "updated_offers_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "error_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "external_id" TEXT,
    "raw_oem" TEXT,
    "normalized_oem" TEXT,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "price" DECIMAL(18,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "OfferCondition" NOT NULL DEFAULT 'NEW',
    "delivery_terms" TEXT,
    "delivery_days" INTEGER,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "city" TEXT,
    "source_url" TEXT,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'VALID',
    "match_type" "ImportMatchType" NOT NULL DEFAULT 'NEW_PRODUCT',
    "matched_product_id" UUID,
    "matched_offer_id" UUID,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_jobs_supplier_id_status_idx" ON "import_jobs"("supplier_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_jobs_created_at_idx" ON "import_jobs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_rows_job_id_status_idx" ON "import_rows"("job_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_rows_normalized_oem_idx" ON "import_rows"("normalized_oem");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_rows_external_id_idx" ON "import_rows"("external_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
