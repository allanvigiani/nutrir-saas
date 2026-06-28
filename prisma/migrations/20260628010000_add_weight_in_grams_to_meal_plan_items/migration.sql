-- AlterTable: adiciona weightInGrams para armazenar peso calculado em gramas
-- DEFAULT garante retrocompatibilidade — registros antigos ficam com weightInGrams = 0
ALTER TABLE "meal_plan_items" ADD COLUMN "weightInGrams" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterColumn: adiciona DEFAULT 'g' ao campo unit existente para novos registros
ALTER TABLE "meal_plan_items" ALTER COLUMN "unit" SET DEFAULT 'g';

-- Backfill: normaliza registros legados com unit vazio ou nulo
UPDATE "meal_plan_items" SET "unit" = 'g' WHERE "unit" = '' OR "unit" IS NULL;
