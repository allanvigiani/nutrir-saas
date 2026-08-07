-- AlterTable: adiciona type para diferenciar plano estruturado (blocks) de texto livre (free)
-- DEFAULT garante retrocompatibilidade — planos existentes ficam com type = 'blocks'
ALTER TABLE "meal_plans" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'blocks';

-- AlterTable: campo de texto livre, usado apenas quando type = 'free'
ALTER TABLE "meal_plans" ADD COLUMN "freeTextContent" TEXT;
