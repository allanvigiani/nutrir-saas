-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN     "calculationId" TEXT,
ADD COLUMN     "consultationId" TEXT,
ADD COLUMN     "customMeals" JSONB;
