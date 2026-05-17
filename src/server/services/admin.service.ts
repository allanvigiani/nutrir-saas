import { getDb } from '../lib/rls-context.ts';
import { subDays } from 'date-fns';

const PREMIUM_PRICE = 39.90;

interface AuditEntry {
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  targetEmail?: string;
  previousValue?: string;
  newValue?: string;
}

export function createAdminService() {
  async function getStats() {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();

    const [total, premium, admin, activeLast30, newLast7, totalPatients] = await Promise.all([
      getDb().nutritionist.count(),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
      getDb().nutritionist.count({ where: { role: 'admin' } }),
      getDb().nutritionist.count({ where: { lastLogin: { gte: thirtyDaysAgo } } }),
      getDb().nutritionist.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      getDb().patient.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalNutritionists: total,
      premiumCount: premium,
      freeCount: total - premium - admin,
      adminCount: admin,
      conversionRate: total > 0 ? Math.round((premium / total) * 100) : 0,
      estimatedRevenue: parseFloat((premium * PREMIUM_PRICE).toFixed(2)),
      activeLast30Days: activeLast30,
      newLast7Days: newLast7,
      totalPatients,
    };
  }

  async function getExpandedStats() {
    const base = await getStats();

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const startOfMonthStr = startOfThisMonth.toISOString();

    const [newSubscribersThisMonth, newSubscribersPrevMonth, pendingChurn, consultationsThisMonth, mealPlansThisMonth] =
      await Promise.all([
        getDb().subscription.count({
          where: { firstSubscriptionDate: { gte: startOfThisMonth } },
        }),
        getDb().subscription.count({
          where: { firstSubscriptionDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
        }),
        getDb().subscription.count({
          where: { cancelAtPeriodEnd: true },
        }),
        getDb().consultation.count({
          where: { date: { gte: startOfMonthStr } },
        }),
        getDb().mealPlan.count({
          where: { createdAt: { gte: startOfThisMonth } },
        }),
      ]);

    return {
      ...base,
      newSubscribersThisMonth,
      newSubscribersPrevMonth,
      pendingChurn,
      consultationsThisMonth,
      mealPlansThisMonth,
    };
  }

  async function listNutritionists({
    page = 1,
    limit = 20,
    filter,
  }: {
    page?: number;
    limit?: number;
    filter?: 'atLimit' | 'churnRisk';
  }) {
    const skip = (page - 1) * limit;
    const thirtyDaysAgo = subDays(new Date(), 30);

    let where: any = {};
    if (filter === 'churnRisk') {
      where = { plan: 'premium', lastLogin: { lt: thirtyDaysAgo } };
    } else if (filter === 'atLimit') {
      where = {
        plan: 'free',
        patients: { some: { status: 'active', deletedAt: null } },
      };
    }

    const [data, total] = await Promise.all([
      getDb().nutritionist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { patients: true } },
          subscription: {
            select: { cancelAtPeriodEnd: true, asaasStatus: true, currentPeriodEnd: true },
          },
        },
      }),
      getDb().nutritionist.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async function logAudit(entry: AuditEntry) {
    await getDb().adminAuditLog.create({ data: entry });
  }

  async function getAuditLogs(limit = 50) {
    return getDb().adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async function getOperationalData() {
    const [noCpfCnpjCount, noPatientsCount, manualPlanOverrides] = await Promise.all([
      getDb().nutritionist.count({
        where: { cpf: null, cnpj: null, role: 'nutritionist' },
      }),
      getDb().nutritionist.count({
        where: { patients: { none: {} }, role: 'nutritionist' },
      }),
      getDb().nutritionist.findMany({
        where: { planOverridedByAdmin: true },
        select: { id: true, name: true, email: true, plan: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return { noCpfCnpjCount, noPatientsCount, manualPlanOverrides };
  }

  return { getStats, getExpandedStats, listNutritionists, logAudit, getAuditLogs, getOperationalData };
}
