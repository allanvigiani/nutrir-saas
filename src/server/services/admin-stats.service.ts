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
    getPaymentMethodBreakdown,
    getConversionFunnel,
    getPlanDistribution,
  };
}
