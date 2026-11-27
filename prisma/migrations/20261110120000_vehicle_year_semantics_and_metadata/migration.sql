-- AlterTable: Add popularity_score and category index to vehicle_makes
ALTER TABLE "vehicle_makes" ADD COLUMN IF NOT EXISTS "popularity_score" INTEGER;
CREATE INDEX IF NOT EXISTS "vehicle_makes_is_popular_popularity_score_idx" ON "vehicle_makes"("is_popular", "popularity_score");
CREATE INDEX IF NOT EXISTS "vehicle_makes_category_idx" ON "vehicle_makes"("category");

-- AlterTable: Add year_semantics, body_types, and popularity_score to vehicle_models
ALTER TABLE "vehicle_models" ADD COLUMN IF NOT EXISTS "year_semantics" TEXT;
ALTER TABLE "vehicle_models" ADD COLUMN IF NOT EXISTS "body_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "vehicle_models" ADD COLUMN IF NOT EXISTS "popularity_score" INTEGER;
CREATE INDEX IF NOT EXISTS "vehicle_models_is_popular_popularity_score_idx" ON "vehicle_models"("is_popular", "popularity_score");
CREATE INDEX IF NOT EXISTS "vehicle_models_category_idx" ON "vehicle_models"("category");

-- AlterTable: Add year_semantics to vehicle_generations
ALTER TABLE "vehicle_generations" ADD COLUMN IF NOT EXISTS "year_semantics" TEXT;
