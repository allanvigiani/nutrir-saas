import { getDb } from '../lib/rls-context.ts';
import { subDays, addDays, differenceInDays } from 'date-fns';

const PREMIUM_PRICE = 39.90;

// Estados do Asaas que representam uma assinatura efetivamente sendo paga agora —
// ver mapeamento de eventos em asaas.service.ts:27-139. Exclui OVERDUE/PENDING/
// AWAITING_RISK_ANALYSIS/DELETED/REFUNDED/INACTIVE, que plan==='premium' sozinho não filtra.
const PAYING_ASAAS_STATUSES = ['CONFIRMED', 'RECEIVED', 'ACTIVE'];

const GRACE_PERIOD_ALERT_WINDOW_DAYS = 7;
const PAYMENT_ISSUE_ASAAS_STATUSES = ['OVERDUE', 'PENDING'];

export type AdminAlertType = 'churnRisk' | 'atLimit' | 'gracePeriodEnding' | 'paymentIssue';

export interface AdminAlert {
  type: AdminAlertType;
  nutritionistId: string;
  name: string;
  email: string;
  detail: string;
}

interface AuditEntry {
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  targetEmail?: string;
  previousValue?: string;
  newValue?: string;
}

// Campos editáveis pela tela admin de detalhe do nutricionista. Allowlist espelhada
// no schema Zod da rota (email/id/role/cpf/cnpj nunca entram aqui).
const EDITABLE_PROFILE_FIELDS = ['name', 'crn', 'phone', 'plan'] as const;
type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

interface NutritionistProfileUpdateInput {
  name?: string;
  crn?: string | null;
  phone?: string | null;
  plan?: string;
}

interface ProfileFieldChange {
  field: EditableProfileField;
  previousValue: string;
  newValue: string;
}

export function createAdminService() {
  async function getStats() {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();

    const [total, premium, payingPremium, admin, activeLast30, newLast7, totalPatients] = await Promise.all([
      getDb().nutritionist.count(),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
      getDb().nutritionist.count({
        where: { plan: 'premium', subscription: { asaasStatus: { in: PAYING_ASAAS_STATUSES } } },
      }),
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
      payingPremiumRevenue: parseFloat((payingPremium * PREMIUM_PRICE).toFixed(2)),
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

  // Extraído de listNutritionists pra ser reaproveitado por listNutritionistsForExport —
  // mesmos dois filtros de engajamento, sem duplicar a lógica.
  function buildNutritionistFilterWhere(filter?: 'atLimit' | 'churnRisk'): any {
    if (filter === 'churnRisk') {
      return { plan: 'premium', lastLogin: { lt: subDays(new Date(), 30) } };
    }
    if (filter === 'atLimit') {
      return { plan: 'free', patients: { some: { status: 'active', deletedAt: null } } };
    }
    return {};
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

    const where = buildNutritionistFilterWhere(filter);

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

  const MAX_EXPORT_ROWS = 5000;
  const MAX_ALERTS_PER_CATEGORY = 500;

  async function listNutritionistsForExport({ filter }: { filter?: 'atLimit' | 'churnRisk' }) {
    const where = buildNutritionistFilterWhere(filter);
    return getDb().nutritionist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        name: true,
        email: true,
        crn: true,
        plan: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        planOverridedByAdmin: true,
        _count: { select: { patients: true } },
      },
    });
  }

  // Busca um nutricionista específico por id — usado pela tela de detalhe admin em
  // acesso direto por URL/refresh (sem depender de location.state ou de paginar a
  // lista inteira no cliente). Mesmo shape de include de listNutritionists, pra a
  // tela de detalhe reaproveitar o mesmo tipo de resposta. Retorna null se não existir.
  async function getNutritionistById(id: string) {
    return getDb().nutritionist.findUnique({
      where: { id },
      include: {
        _count: { select: { patients: true } },
        subscription: {
          select: { cancelAtPeriodEnd: true, asaasStatus: true, currentPeriodEnd: true },
        },
      },
    });
  }

  // Atualiza nome/CRN/telefone/plano de um nutricionista e retorna o diff (campo,
  // valor anterior, valor novo) só dos campos que de fato mudaram — usado pelo route
  // handler para gerar as entradas de audit log. Retorna null se o id não existir.
  async function updateNutritionistProfile(
    id: string,
    data: NutritionistProfileUpdateInput
  ): Promise<{ nutritionist: any; email: string; changes: ProfileFieldChange[] } | null> {
    const existing = await getDb().nutritionist.findUnique({
      where: { id },
      select: { email: true, name: true, crn: true, phone: true, plan: true },
    });
    if (!existing) return null;

    const changes: ProfileFieldChange[] = [];
    const updateData: Record<string, unknown> = {};

    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (data[field] === undefined) continue;
      const previousValue = (existing as any)[field] ?? '';
      const newValue = data[field] ?? '';
      if (previousValue === newValue) continue;
      updateData[field] = data[field];
      changes.push({ field, previousValue: String(previousValue), newValue: String(newValue) });
    }

    // Mesmo comportamento do endpoint anterior: mudança manual de plano marca o override.
    if (updateData.plan !== undefined) {
      updateData.planOverridedByAdmin = true;
    }

    if (Object.keys(updateData).length === 0) {
      return { nutritionist: existing, email: existing.email, changes: [] };
    }

    const nutritionist = await getDb().nutritionist.update({ where: { id }, data: updateData });
    return { nutritionist, email: existing.email, changes };
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

  async function getAlerts(): Promise<AdminAlert[]> {
    const now = new Date();
    const graceWindowEnd = addDays(now, GRACE_PERIOD_ALERT_WINDOW_DAYS);

    const [churnRiskList, atLimitList, graceEndingList, paymentIssueList] = await Promise.all([
      getDb().nutritionist.findMany({
        where: buildNutritionistFilterWhere('churnRisk'),
        select: { id: true, name: true, email: true, lastLogin: true },
        orderBy: { lastLogin: 'asc' },
        take: MAX_ALERTS_PER_CATEGORY,
      }),
      getDb().nutritionist.findMany({
        where: buildNutritionistFilterWhere('atLimit'),
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_ALERTS_PER_CATEGORY,
      }),
      getDb().nutritionist.findMany({
        where: { gracePeriodEndAt: { gte: now, lte: graceWindowEnd } },
        select: { id: true, name: true, email: true, gracePeriodEndAt: true },
        orderBy: { gracePeriodEndAt: 'asc' },
        take: MAX_ALERTS_PER_CATEGORY,
      }),
      getDb().nutritionist.findMany({
        where: { subscription: { asaasStatus: { in: PAYMENT_ISSUE_ASAAS_STATUSES } } },
        select: { id: true, name: true, email: true, subscription: { select: { asaasStatus: true } } },
        orderBy: { createdAt: 'desc' },
        take: MAX_ALERTS_PER_CATEGORY,
      }),
    ]);

    const alerts: AdminAlert[] = [];

    for (const n of churnRiskList) {
      const days = n.lastLogin ? differenceInDays(now, new Date(n.lastLogin)) : null;
      alerts.push({
        type: 'churnRisk',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: days !== null ? `Sem login há ${days} dias` : 'Nunca fez login',
      });
    }

    for (const n of atLimitList) {
      alerts.push({
        type: 'atLimit',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: 'Plano gratuito com paciente ativo',
      });
    }

    for (const n of graceEndingList) {
      const days = n.gracePeriodEndAt ? differenceInDays(new Date(n.gracePeriodEndAt), now) : null;
      alerts.push({
        type: 'gracePeriodEnding',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: days !== null ? `Período de carência termina em ${days} dia(s)` : 'Período de carência terminando',
      });
    }

    for (const n of paymentIssueList) {
      alerts.push({
        type: 'paymentIssue',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: `Status Asaas: ${n.subscription?.asaasStatus ?? 'desconhecido'}`,
      });
    }

    return alerts;
  }

  return {
    getStats,
    getExpandedStats,
    listNutritionists,
    listNutritionistsForExport,
    getNutritionistById,
    updateNutritionistProfile,
    logAudit,
    getAuditLogs,
    getOperationalData,
    getAlerts,
  };
}
