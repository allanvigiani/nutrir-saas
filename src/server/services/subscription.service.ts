import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

type SubscriptionData = {
  plan?: string;
  asaasSubscriptionId?: string | null;
  asaasStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  firstSubscriptionDate?: Date | string | null;
  hadRefundBefore?: boolean;
  lastCheckedAt?: Date | string | null;
};

export function createSubscriptionService({ prisma }: Deps) {
  async function getByNutritionistId(nutritionistId: string) {
    return prisma.subscription.findUnique({ where: { nutritionistId } });
  }

  async function upsert(nutritionistId: string, data: SubscriptionData) {
    const toDate = (v: Date | string | null | undefined) =>
      v == null ? null : v instanceof Date ? v : new Date(v);

    const payload = {
      plan: data.plan,
      asaasSubscriptionId: data.asaasSubscriptionId,
      asaasStatus: data.asaasStatus,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      currentPeriodEnd: toDate(data.currentPeriodEnd),
      firstSubscriptionDate: toDate(data.firstSubscriptionDate),
      hadRefundBefore: data.hadRefundBefore,
      lastCheckedAt: data.lastCheckedAt ? toDate(data.lastCheckedAt) : new Date(),
    };

    // Remove undefined keys so Prisma doesn't complain
    const clean = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );

    const sub = await prisma.subscription.upsert({
      where: { nutritionistId },
      update: clean,
      create: { nutritionistId, ...clean },
    });

    // Keep Nutritionist.plan in sync if plan changed
    if (data.plan) {
      await prisma.nutritionist.update({
        where: { id: nutritionistId },
        data: { plan: data.plan },
      });
    }

    return sub;
  }

  return { getByNutritionistId, upsert };
}
