-- AlterTable: Add cpfHash and cnpjHash to nutritionists
ALTER TABLE "nutritionists" ADD COLUMN "cpfHash" TEXT;
ALTER TABLE "nutritionists" ADD COLUMN "cnpjHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "nutritionists_cpfHash_key" ON "nutritionists"("cpfHash");

-- CreateIndex
CREATE UNIQUE INDEX "nutritionists_cnpjHash_key" ON "nutritionists"("cnpjHash");

-- AlterTable: Add deletedAt to patients
ALTER TABLE "patients" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Add onDelete Cascade to patients -> nutritionists
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_nutritionistId_fkey";
ALTER TABLE "patients" ADD CONSTRAINT "patients_nutritionistId_fkey" FOREIGN KEY ("nutritionistId") REFERENCES "nutritionists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add onDelete Cascade to appointments -> nutritionists
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_nutritionistId_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_nutritionistId_fkey" FOREIGN KEY ("nutritionistId") REFERENCES "nutritionists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add onDelete Cascade to payments -> nutritionists
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_nutritionistId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_nutritionistId_fkey" FOREIGN KEY ("nutritionistId") REFERENCES "nutritionists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add onDelete Cascade to custom_foods -> nutritionists
ALTER TABLE "custom_foods" DROP CONSTRAINT IF EXISTS "custom_foods_nutritionistId_fkey";
ALTER TABLE "custom_foods" ADD CONSTRAINT "custom_foods_nutritionistId_fkey" FOREIGN KEY ("nutritionistId") REFERENCES "nutritionists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
