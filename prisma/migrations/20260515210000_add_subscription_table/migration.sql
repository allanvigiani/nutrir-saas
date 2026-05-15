-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "nutritionistId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "asaasSubscriptionId" TEXT,
    "asaasStatus" TEXT,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" TIMESTAMP(3),
    "firstSubscriptionDate" TIMESTAMP(3),
    "hadRefundBefore" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_nutritionistId_key" ON "subscriptions"("nutritionistId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_nutritionistId_fkey" FOREIGN KEY ("nutritionistId") REFERENCES "nutritionists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove subscription fields from nutritionists
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "subscriptionId";
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "subscriptionStatus";
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "cancelAtPeriodEnd";
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "currentPeriodEnd";
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "firstSubscriptionDate";
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "hadRefundBefore";
ALTER TABLE "nutritionists" DROP COLUMN IF EXISTS "lastSubscriptionCheck";
