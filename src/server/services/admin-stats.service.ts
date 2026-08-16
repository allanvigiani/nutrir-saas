import { getDb } from '../lib/rls-context.ts';

// Pagamentos com status 'paid' são os únicos considerados "confirmados" hoje
// (confirmado observando os valores reais gravados em produção — ver Financial.tsx,
// que só grava 'paid' | 'pending' | 'cancelled' via o form de pagamentos do nutricionista).
const CONFIRMED_PAYMENT_STATUS = 'paid';

export interface MonthlyPoint {
  month: string; // 'YYYY-MM'
  value: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  total: number;
  count: number;
  average: number;
}

export interface ConversionFunnel {
  signedUp: number;
  activated: number;
  premium: number;
}

export interface CohortRetention {
  cohortMonth: string;
  cohortSize: number;
  retention: { offset: number; pct: number }[];
}

const MAX_COHORT_OFFSET = 3;

// `from`/`to` chegam do route handler como `new Date('yyyy-MM-dd')`, que o runtime
// interpreta como meia-noite **UTC** daquele dia — não hora local do processo. Todo
// agrupamento por mês abaixo precisa usar os getters UTC (getUTCFullYear/getUTCMonth),
// nunca getFullYear/getMonth: em qualquer TZ atrás de UTC (ex.: America/Sao_Paulo, o
// fuso do público do Nutrir) os getters locais deslocam a data para o dia/mês anterior
// e desalinham o bucket.
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildMonthRange(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

// `to` chega como meia-noite UTC do dia selecionado. Um filtro `lte: to` deixaria de
// fora praticamente o dia inteiro (só o instante exato 00:00:00.000 bateria). Para
// incluir o dia de `to` por completo, comparamos com `lt` o início do dia seguinte.
function endOfRangeExclusive(to: Date): Date {
  return new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1));
}

function fillMonths(months: string[], values: Map<string, number>): MonthlyPoint[] {
  return months.map((month) => ({ month, value: values.get(month) ?? 0 }));
}

export function createAdminStatsService() {
  async function getRevenueByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    const payments = await getDb().payment.findMany({
      where: { status: CONFIRMED_PAYMENT_STATUS, deletedAt: null, date: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { date: true, amount: true },
    });

    const totals = new Map<string, number>();
    for (const payment of payments) {
      const key = monthKey(payment.date);
      totals.set(key, (totals.get(key) ?? 0) + payment.amount);
    }

    return buildMonthRange(from, to).map((month) => ({
      month,
      value: parseFloat((totals.get(month) ?? 0).toFixed(2)),
    }));
  }

  async function getPaymentMethodBreakdown(from: Date, to: Date): Promise<PaymentMethodBreakdown[]> {
    const payments = await getDb().payment.findMany({
      where: { status: CONFIRMED_PAYMENT_STATUS, deletedAt: null, date: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { method: true, amount: true },
    });

    const totals = new Map<string, { total: number; count: number }>();
    for (const payment of payments) {
      const entry = totals.get(payment.method) ?? { total: 0, count: 0 };
      entry.total += payment.amount;
      entry.count += 1;
      totals.set(payment.method, entry);
    }

    return Array.from(totals.entries())
      .map(([method, { total, count }]) => ({
        method,
        total: parseFloat(total.toFixed(2)),
        count,
        average: parseFloat((total / count).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);
  }

  async function getConversionFunnel(from: Date, to: Date): Promise<ConversionFunnel> {
    const createdRange = { gte: from, lt: endOfRangeExclusive(to) };

    const [signedUp, activated, premium] = await Promise.all([
      getDb().nutritionist.count({ where: { createdAt: createdRange } }),
      getDb().nutritionist.count({
        where: { createdAt: createdRange, patients: { some: { status: 'active', deletedAt: null } } },
      }),
      getDb().nutritionist.count({ where: { createdAt: createdRange, plan: 'premium' } }),
    ]);

    return { signedUp, activated, premium };
  }

  async function getPatientsGrowthByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    const patients = await getDb().patient.findMany({
      where: { createdAt: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { createdAt: true },
    });

    const counts = new Map<string, number>();
    for (const patient of patients) {
      const key = monthKey(patient.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return fillMonths(buildMonthRange(from, to), counts);
  }

  async function getNewSubscribersByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    const subscriptions = await getDb().subscription.findMany({
      where: { firstSubscriptionDate: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { firstSubscriptionDate: true },
    });

    const counts = new Map<string, number>();
    for (const subscription of subscriptions) {
      if (!subscription.firstSubscriptionDate) continue;
      const key = monthKey(subscription.firstSubscriptionDate);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return fillMonths(buildMonthRange(from, to), counts);
  }

  async function getConsultationsByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    // Consultation.date é armazenado como string ISO (não DateTime) — comparação
    // lexicográfica funciona pois o formato é sempre ISO 8601, mesmo padrão já
    // usado em admin.service.ts#getExpandedStats.
    const consultations = await getDb().consultation.findMany({
      where: { deletedAt: null, date: { gte: from.toISOString(), lt: endOfRangeExclusive(to).toISOString() } },
      select: { date: true },
    });

    const counts = new Map<string, number>();
    for (const consultation of consultations) {
      const parsed = new Date(consultation.date);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = monthKey(parsed);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return fillMonths(buildMonthRange(from, to), counts);
  }

  async function getMealPlansByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    const mealPlans = await getDb().mealPlan.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { createdAt: true },
    });

    const counts = new Map<string, number>();
    for (const mealPlan of mealPlans) {
      const key = monthKey(mealPlan.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return fillMonths(buildMonthRange(from, to), counts);
  }

  async function getChurnRateByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    // O numerador (cancelamentos) é filtrado por mês do período queried, mas o denominador
    // (currentPremiumCount) é um snapshot *atual* do total de nutricionistas premium — não
    // histórico per-mês, porque não há armazenamento de premium-count-over-time no schema.
    // Logo, a churn rate retornada é uma aproximação (não coorte exato por mês). Chamadores
    // devem rotular o gráfico como "aproximado" na UI.
    const [cancellations, currentPremiumCount] = await Promise.all([
      getDb().subscription.findMany({
        where: { cancelAtPeriodEnd: true, currentPeriodEnd: { gte: from, lt: endOfRangeExclusive(to) } },
        select: { currentPeriodEnd: true },
      }),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
    ]);

    const counts = new Map<string, number>();
    for (const sub of cancellations) {
      if (!sub.currentPeriodEnd) continue;
      const key = monthKey(sub.currentPeriodEnd);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return buildMonthRange(from, to).map((month) => {
      const cancelled = counts.get(month) ?? 0;
      const value = currentPremiumCount > 0 ? Math.round((cancelled / currentPremiumCount) * 1000) / 10 : 0;
      return { month, value };
    });
  }

  async function getRetentionCohorts(from: Date, to: Date): Promise<CohortRetention[]> {
    const cohortMonths = buildMonthRange(from, to);

    const nutritionists = await getDb().nutritionist.findMany({
      where: { createdAt: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { id: true, createdAt: true },
    });

    if (nutritionists.length === 0) {
      return cohortMonths.map((cohortMonth) => ({ cohortMonth, cohortSize: 0, retention: [] }));
    }

    const cohortsByMonth = new Map<string, string[]>();
    for (const n of nutritionists) {
      const key = monthKey(n.createdAt);
      const ids = cohortsByMonth.get(key) ?? [];
      ids.push(n.id);
      cohortsByMonth.set(key, ids);
    }

    const allIds = nutritionists.map((n) => n.id);
    const [consultations, mealPlans] = await Promise.all([
      getDb().consultation.findMany({
        where: { nutritionistId: { in: allIds } },
        select: { nutritionistId: true, date: true },
      }),
      getDb().mealPlan.findMany({
        where: { nutritionistId: { in: allIds } },
        select: { nutritionistId: true, createdAt: true },
      }),
    ]);

    const activeMonthsByNutritionist = new Map<string, Set<string>>();
    const markActive = (nutritionistId: string, date: Date) => {
      if (Number.isNaN(date.getTime())) return;
      const set = activeMonthsByNutritionist.get(nutritionistId) ?? new Set<string>();
      set.add(monthKey(date));
      activeMonthsByNutritionist.set(nutritionistId, set);
    };
    for (const c of consultations) {
      markActive(c.nutritionistId, new Date(c.date));
    }
    for (const m of mealPlans) {
      markActive(m.nutritionistId, m.createdAt);
    }

    const now = new Date();

    return cohortMonths.map((cohortMonth) => {
      const ids = cohortsByMonth.get(cohortMonth) ?? [];
      const [cohortYear, cohortMonthNum] = cohortMonth.split('-').map(Number);
      const retention: { offset: number; pct: number }[] = [];

      for (let offset = 0; offset <= MAX_COHORT_OFFSET; offset++) {
        const offsetDate = new Date(Date.UTC(cohortYear, cohortMonthNum - 1 + offset, 1));
        if (offsetDate > now) break;
        const offsetKey = monthKey(offsetDate);
        const retained = ids.filter((id) => activeMonthsByNutritionist.get(id)?.has(offsetKey)).length;
        const pct = ids.length > 0 ? Math.round((retained / ids.length) * 1000) / 10 : 0;
        retention.push({ offset, pct });
      }

      return { cohortMonth, cohortSize: ids.length, retention };
    });
  }

  async function getPlanDistribution() {
    // Mesma lógica de admin.service.ts#getStats (freeCount = total - premium - admin),
    // pra não divergir do que os cards existentes já mostram.
    const [total, premium, admin] = await Promise.all([
      getDb().nutritionist.count(),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
      getDb().nutritionist.count({ where: { role: 'admin' } }),
    ]);

    return {
      free: total - premium - admin,
      premium,
      admin,
      total,
    };
  }

  return {
    getRevenueByMonth,
    getPatientsGrowthByMonth,
    getNewSubscribersByMonth,
    getConsultationsByMonth,
    getMealPlansByMonth,
    getChurnRateByMonth,
    getRetentionCohorts,
    getPaymentMethodBreakdown,
    getConversionFunnel,
    getPlanDistribution,
  };
}
