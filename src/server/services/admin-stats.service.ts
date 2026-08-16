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

export interface ActivityHeatmapPoint {
  day: number; // 0 (domingo) a 6 (sábado), UTC
  hour: number; // 0-23, UTC
  count: number;
}

const MAX_COHORT_OFFSET = 3;
const ACTIVITY_HEATMAP_WINDOW_DAYS = 90;

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

  // `Payment` aqui é o faturamento paciente→nutricionista via a feature "Financeiro"
  // (cobranças que o nutricionista registra pros próprios pacientes) — NÃO é receita de
  // assinatura do Nutrir (essa vem de `Subscription`/Asaas, ver payingPremiumRevenue em
  // admin.service.ts#getStats). Não confundir os dois nos cards/gráficos do admin.
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
      // "Ativado" = já teve QUALQUER paciente ativo em algum momento, sem limite de tempo
      // desde o cadastro (ex.: cadastrou em janeiro, só teve o 1º paciente em dezembro
      // ainda conta). É "ativou alguma vez", não "ativou em até N dias do cadastro" — se
      // um funil com janela temporal for necessário no futuro, isso precisa mudar.
      getDb().nutritionist.count({
        where: { createdAt: createdRange, patients: { some: { status: 'active', deletedAt: null } } },
      }),
      // `plan: 'premium'` aqui mede "já converteu pra premium alguma vez" (semântica de
      // funil de conversão) — de propósito diferente de payingPremiumRevenue em
      // admin.service.ts#getStats, que filtra por `Subscription.asaasStatus` pra saber
      // quem está pagando *agora*. Não "corrigir" isto pra bater com getStats: são
      // métricas distintas por design (funil vs. receita atual).
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

  async function getLabExamAdherenceByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    // LabExam.date é string ISO (não DateTime), mesmo padrão de getConsultationsByMonth
    // nesta service — comparação lexicográfica funciona pois o formato é sempre ISO 8601.
    const labExams = await getDb().labExam.findMany({
      where: { deletedAt: null, date: { gte: from.toISOString(), lt: endOfRangeExclusive(to).toISOString() } },
      select: { date: true },
    });

    const counts = new Map<string, number>();
    for (const labExam of labExams) {
      const parsed = new Date(labExam.date);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = monthKey(parsed);
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
    //
    // O numerador também não é um registro histórico estável: `cancelAtPeriodEnd` é uma
    // flag de "cancelamento agendado/pendente", não um fato histórico imutável. Ela volta
    // pra `false` por outros pontos do código quando o ciclo de cancelamento se completa
    // (`src/server/middlewares/subscription-expiry.ts`) ou quando o pagamento é reembolsado
    // (`verifySubscription` em `src/server/services/asaas.service.ts`, que também zera
    // `currentPeriodEnd` inteiramente nesse caso). Ou seja: rodar esta mesma query pro mesmo
    // range de datas passadas novamente daqui a uma semana vai retornar números MENORES do
    // que hoje pros mesmos meses passados, porque assinaturas que já churnaram/foram
    // reembolsadas nesse meio tempo somem da contagem. Isto é mais próximo de
    // "cancelamentos agendados/pendentes por mês" (um snapshot do momento da consulta) do
    // que uma série de "churn histórico" estável — chamadores não devem apresentar isso
    // como se fosse a segunda coisa.
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

    const cohortsByMonth = new Map<string, string[]>();
    for (const n of nutritionists) {
      const key = monthKey(n.createdAt);
      const ids = cohortsByMonth.get(key) ?? [];
      ids.push(n.id);
      cohortsByMonth.set(key, ids);
    }

    const allIds = nutritionists.map((n) => n.id);

    // Janela de atividade relevante para o range de cohorts pedido: só interessa atividade
    // entre o início do range (`from`) e o mês do cohort mais tardio (`to`) + MAX_COHORT_OFFSET
    // — nenhum offset além disso é alcançável por nenhum cohort deste range, e
    // activeMonthsByNutritionist descartaria silenciosamente qualquer atividade fora dessa
    // janela de qualquer forma. Sem esse limite, num range de 24 meses a query buscaria o
    // histórico completo de cada nutricionista até hoje, bem além do que é usado.
    const activityWindowEnd = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1 + MAX_COHORT_OFFSET, 1));

    const [consultations, mealPlans] = allIds.length > 0
      ? await Promise.all([
          // Consultation.date é armazenado como string ISO (não DateTime) — comparação
          // lexicográfica, mesmo padrão de getConsultationsByMonth nesta service.
          getDb().consultation.findMany({
            where: {
              nutritionistId: { in: allIds },
              deletedAt: null,
              date: { gte: from.toISOString(), lt: activityWindowEnd.toISOString() },
            },
            select: { nutritionistId: true, date: true },
          }),
          getDb().mealPlan.findMany({
            where: {
              nutritionistId: { in: allIds },
              deletedAt: null,
              createdAt: { gte: from, lt: activityWindowEnd },
            },
            select: { nutritionistId: true, createdAt: true },
          }),
        ])
      : [[] as { nutritionistId: string; date: string }[], [] as { nutritionistId: string; createdAt: Date }[]];

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

      // Cohort sem nenhum cadastro no mês: sempre `retention: []`, tanto quando é o único
      // cohort do range (dataset inteiro vazio) quanto quando é só um mês vazio no meio de
      // um range com outros meses com cadastro — mesmo shape nos dois casos, pra não obrigar
      // quem consome isso a tratar duas formas diferentes de "sem cohort".
      if (ids.length === 0) {
        return { cohortMonth, cohortSize: 0, retention: [] };
      }

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

  async function getActivityHeatmap(): Promise<ActivityHeatmapPoint[]> {
    const windowStart = new Date(Date.now() - ACTIVITY_HEATMAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [consultations, appointments] = await Promise.all([
      // Consultation.date é string ISO — comparação lexicográfica, mesmo padrão do resto
      // do arquivo.
      getDb().consultation.findMany({
        where: { deletedAt: null, date: { gte: windowStart.toISOString() } },
        select: { date: true },
      }),
      getDb().appointment.findMany({
        where: { deletedAt: null, date: { gte: windowStart } },
        select: { date: true },
      }),
    ]);

    const counts = new Map<string, number>();
    const mark = (date: Date) => {
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (const c of consultations) mark(new Date(c.date));
    for (const a of appointments) mark(a.date);

    const points: ActivityHeatmapPoint[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        points.push({ day, hour, count: counts.get(`${day}-${hour}`) ?? 0 });
      }
    }
    return points;
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
    getLabExamAdherenceByMonth,
    getChurnRateByMonth,
    getRetentionCohorts,
    getActivityHeatmap,
    getPaymentMethodBreakdown,
    getConversionFunnel,
    getPlanDistribution,
  };
}
