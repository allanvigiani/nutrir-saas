import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDb = {
  payment: { findMany: vi.fn() },
  patient: { findMany: vi.fn() },
  subscription: { findMany: vi.fn() },
  consultation: { findMany: vi.fn() },
  mealPlan: { findMany: vi.fn() },
  labExam: { findMany: vi.fn() },
  appointment: { findMany: vi.fn() },
  nutritionist: { count: vi.fn(), findMany: vi.fn() },
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: vi.fn(() => mockDb),
}));

import { createAdminStatsService } from '../../server/services/admin-stats.service.ts';

// Constrói datas a partir de componentes locais (ano, mês 1-indexado, dia, hora), nunca
// via parse de string ISO — `new Date('2026-06-01')` é interpretado como meia-noite UTC,
// e getFullYear()/getMonth() (usados pelo service) leem em horário LOCAL. Em qualquer
// ambiente com TZ atrás de UTC (ex.: America/Sao_Paulo, o fuso do próprio público do
// Nutrir), isso desalinha o mês de um dado próximo à virada do dia/mês — ver finding
// de QA sobre admin-stats.service.ts. Usar componentes locais aqui mantém os testes
// determinísticos independente do TZ do executor, sem mascarar ou depender do bug.
function d(year: number, month: number, day: number, hour = 12) {
  return new Date(year, month - 1, day, hour);
}

// Espelha endOfRangeExclusive do service (não exportada) — usado só pra montar a
// expectativa dos testes que checam o shape exato da query enviada ao Prisma.
function endOfRangeExclusive(to: Date): Date {
  return new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1));
}

describe('AdminStatsService.getRevenueByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soma Payment.amount por mês, considerando só status "paid"', async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { date: d(2026, 6, 5), amount: 100 },
      { date: d(2026, 6, 20), amount: 50.5 },
      { date: d(2026, 7, 1), amount: 200 },
    ]);

    const service = createAdminStatsService();
    const result = await service.getRevenueByMonth(d(2026, 6, 1), d(2026, 7, 31));

    expect(mockDb.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'paid', deletedAt: null }),
      })
    );
    expect(result).toEqual([
      { month: '2026-06', value: 150.5 },
      { month: '2026-07', value: 200 },
    ]);
  });

  it('preenche meses sem pagamento com value: 0', async () => {
    mockDb.payment.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRevenueByMonth(d(2026, 1, 1), d(2026, 3, 1));

    expect(result).toEqual([
      { month: '2026-01', value: 0 },
      { month: '2026-02', value: 0 },
      { month: '2026-03', value: 0 },
    ]);
  });

  it('range de um único mês retorna um único ponto', async () => {
    mockDb.payment.findMany.mockResolvedValue([{ date: d(2026, 5, 10), amount: 10 }]);

    const service = createAdminStatsService();
    const result = await service.getRevenueByMonth(d(2026, 5, 1), d(2026, 5, 31));

    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('2026-05');
  });
});

describe('AdminStatsService.getPatientsGrowthByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa contagem de pacientes criados por mês', async () => {
    mockDb.patient.findMany.mockResolvedValue([
      { createdAt: d(2026, 6, 1) },
      { createdAt: d(2026, 6, 15) },
      { createdAt: d(2026, 7, 1) },
    ]);

    const service = createAdminStatsService();
    const result = await service.getPatientsGrowthByMonth(d(2026, 6, 1), d(2026, 7, 31));

    expect(result).toEqual([
      { month: '2026-06', value: 2 },
      { month: '2026-07', value: 1 },
    ]);
  });
});

describe('AdminStatsService.getNewSubscribersByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa por firstSubscriptionDate e ignora registros sem essa data', async () => {
    mockDb.subscription.findMany.mockResolvedValue([
      { firstSubscriptionDate: d(2026, 6, 10) },
      { firstSubscriptionDate: null },
    ]);

    const service = createAdminStatsService();
    const result = await service.getNewSubscribersByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 1 }]);
  });
});

describe('AdminStatsService.getConsultationsByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filtra deletedAt e usa toISOString no range da query', async () => {
    const consultationDate1 = d(2026, 6, 5).toISOString();
    const consultationDate2 = d(2026, 6, 20).toISOString();
    mockDb.consultation.findMany.mockResolvedValue([
      { date: consultationDate1 },
      { date: consultationDate2 },
    ]);

    const from = d(2026, 6, 1);
    const to = d(2026, 6, 30);
    const service = createAdminStatsService();
    const result = await service.getConsultationsByMonth(from, to);

    expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, date: { gte: from.toISOString(), lt: endOfRangeExclusive(to).toISOString() } },
      })
    );
    expect(result).toEqual([{ month: '2026-06', value: 2 }]);
  });

  it('ignora registros com date inválida (não numérica ao fazer parse)', async () => {
    mockDb.consultation.findMany.mockResolvedValue([
      { date: 'data-invalida' },
      { date: d(2026, 6, 5).toISOString() },
    ]);

    const service = createAdminStatsService();
    const result = await service.getConsultationsByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 1 }]);
  });
});

describe('AdminStatsService.getMealPlansByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa contagem de planos alimentares criados por mês, excluindo deletedAt', async () => {
    mockDb.mealPlan.findMany.mockResolvedValue([{ createdAt: d(2026, 6, 15) }]);

    const service = createAdminStatsService();
    const result = await service.getMealPlansByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(mockDb.mealPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(result).toEqual([{ month: '2026-06', value: 1 }]);
  });
});

describe('AdminStatsService.getLabExamAdherenceByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa contagem de exames laboratoriais criados por mês, excluindo deletedAt', async () => {
    mockDb.labExam.findMany.mockResolvedValue([
      { date: d(2026, 6, 5).toISOString() },
      { date: d(2026, 6, 20).toISOString() },
      { date: d(2026, 7, 1).toISOString() },
    ]);

    const service = createAdminStatsService();
    const result = await service.getLabExamAdherenceByMonth(d(2026, 6, 1), d(2026, 7, 31));

    expect(mockDb.labExam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(result).toEqual([
      { month: '2026-06', value: 2 },
      { month: '2026-07', value: 1 },
    ]);
  });

  it('ignora registros com date inválida (não numérica ao fazer parse)', async () => {
    mockDb.labExam.findMany.mockResolvedValue([
      { date: 'data-invalida' },
      { date: d(2026, 6, 5).toISOString() },
    ]);

    const service = createAdminStatsService();
    const result = await service.getLabExamAdherenceByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 1 }]);
  });
});

describe('AdminStatsService — regressão de timezone (QA ALTO 1 e ALTO 2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ALTO 1: não prepende um mês extra quando from/to vêm como string yyyy-MM-dd (meia-noite UTC)', async () => {
    // Reprodução exata do finding de QA: `from`/`to` chegam ao service como
    // `new Date(query.from)`, que interpreta 'yyyy-MM-dd' como meia-noite UTC — não
    // hora local. Rodando neste sandbox (America/Sao_Paulo, UTC-3), getFullYear()/
    // getMonth() (locais) liam 2026-03-01T00:00:00Z como 2026-02-28 21:00 local e
    // prependiam '2026-02' ao range. monthKey/buildMonthRange devem usar os getters
    // UTC e nunca reproduzir esse deslocamento.
    mockDb.payment.findMany.mockResolvedValue([]);

    const from = new Date('2026-03-01');
    const to = new Date('2026-08-14');
    const service = createAdminStatsService();
    const result = await service.getRevenueByMonth(from, to);

    expect(result.map((p) => p.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
  });

  it('ALTO 2: inclui o dia inteiro de `to` (não só o instante 00:00:00 UTC)', async () => {
    // `to` chega como meia-noite UTC do dia selecionado. Um pagamento feito às
    // 20:00 UTC do próprio dia de `to` (ainda 14/08 em qualquer fuso do Brasil)
    // precisa entrar no total — antes da correção, `lte: to` descartava esse
    // registro porque só o instante exato 00:00:00.000 batia.
    const to = new Date('2026-08-14');
    mockDb.payment.findMany.mockResolvedValue([
      { date: new Date('2026-08-14T20:00:00.000Z'), amount: 42 },
    ]);

    const service = createAdminStatsService();
    const result = await service.getRevenueByMonth(new Date('2026-08-01'), to);

    expect(result.find((p) => p.month === '2026-08')?.value).toBe(42);

    // E a query em si precisa usar `lt` o início do dia seguinte, nunca `lte: to`.
    expect(mockDb.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gte: new Date('2026-08-01'), lt: new Date('2026-08-15T00:00:00.000Z') },
        }),
      })
    );
  });

  it('ALTO 2: mesma correção se aplica a getPatientsGrowthByMonth/getMealPlansByMonth (queries com Date)', async () => {
    const to = new Date('2026-08-14');
    mockDb.patient.findMany.mockResolvedValue([]);
    mockDb.mealPlan.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    await service.getPatientsGrowthByMonth(new Date('2026-08-01'), to);
    await service.getMealPlansByMonth(new Date('2026-08-01'), to);

    const expectedLt = new Date('2026-08-15T00:00:00.000Z');
    expect(mockDb.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: new Date('2026-08-01'), lt: expectedLt } }) })
    );
    expect(mockDb.mealPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: new Date('2026-08-01'), lt: expectedLt } }) })
    );
  });
});

describe('AdminStatsService.getPaymentMethodBreakdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa total/quantidade/ticket médio por método, só status "paid"', async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { method: 'pix', amount: 100 },
      { method: 'pix', amount: 50 },
      { method: 'credit_card', amount: 200 },
    ]);

    const service = createAdminStatsService();
    const result = await service.getPaymentMethodBreakdown(d(2026, 6, 1), d(2026, 6, 30));

    expect(mockDb.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'paid', deletedAt: null }) })
    );
    expect(result).toEqual([
      { method: 'credit_card', total: 200, count: 1, average: 200 },
      { method: 'pix', total: 150, count: 2, average: 75 },
    ]);
  });

  it('retorna array vazio quando não há pagamentos no período', async () => {
    mockDb.payment.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getPaymentMethodBreakdown(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([]);
  });
});

describe('AdminStatsService.getPlanDistribution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula free = total - premium - admin, mesma fórmula de getStats', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(4) // premium
      .mockResolvedValueOnce(1); // admin

    const service = createAdminStatsService();
    const result = await service.getPlanDistribution();

    expect(result).toEqual({ free: 5, premium: 4, admin: 1, total: 10 });
  });

  it('retorna todos zerados quando não há nutricionistas', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);

    const service = createAdminStatsService();
    const result = await service.getPlanDistribution();

    expect(result).toEqual({ free: 0, premium: 0, admin: 0, total: 0 });
  });
});

describe('AdminStatsService.getConversionFunnel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('conta cadastrados, ativados (com paciente ativo) e premium no período', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(20) // signedUp
      .mockResolvedValueOnce(12) // activated
      .mockResolvedValueOnce(5); // premium

    const service = createAdminStatsService();
    const result = await service.getConversionFunnel(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual({ signedUp: 20, activated: 12, premium: 5 });
    expect(mockDb.nutritionist.count).toHaveBeenNthCalledWith(2, {
      where: {
        createdAt: expect.any(Object),
        patients: { some: { status: 'active', deletedAt: null } },
      },
    });
    expect(mockDb.nutritionist.count).toHaveBeenNthCalledWith(3, {
      where: { createdAt: expect.any(Object), plan: 'premium' },
    });
  });
});

describe('AdminStatsService.getChurnRateByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula % de cancelamentos (currentPeriodEnd no mês, cancelAtPeriodEnd true) sobre o total premium atual', async () => {
    mockDb.subscription.findMany.mockResolvedValue([
      { currentPeriodEnd: d(2026, 6, 10) },
      { currentPeriodEnd: d(2026, 6, 20) },
      { currentPeriodEnd: d(2026, 7, 5) },
    ]);
    mockDb.nutritionist.count.mockResolvedValue(20); // premium atual

    const service = createAdminStatsService();
    const result = await service.getChurnRateByMonth(d(2026, 6, 1), d(2026, 7, 31));

    expect(mockDb.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cancelAtPeriodEnd: true }),
      })
    );
    expect(result).toEqual([
      { month: '2026-06', value: 10 }, // 2/20 * 100
      { month: '2026-07', value: 5 },  // 1/20 * 100
    ]);
  });

  it('retorna 0 em todos os meses quando não há assinantes premium', async () => {
    mockDb.subscription.findMany.mockResolvedValue([]);
    mockDb.nutritionist.count.mockResolvedValue(0);

    const service = createAdminStatsService();
    const result = await service.getChurnRateByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 0 }]);
  });

  it('ignora assinaturas com currentPeriodEnd nulo', async () => {
    mockDb.subscription.findMany.mockResolvedValue([{ currentPeriodEnd: null }]);
    mockDb.nutritionist.count.mockResolvedValue(10);

    const service = createAdminStatsService();
    const result = await service.getChurnRateByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 0 }]);
  });
});

describe('AdminStatsService.getRetentionCohorts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 9, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrupa por mês de cadastro e marca retido se houve consulta/plano naquele mês civil', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: 'n1', createdAt: d(2026, 6, 5) },
      { id: 'n2', createdAt: d(2026, 6, 20) },
    ]);
    mockDb.consultation.findMany.mockResolvedValue([
      { nutritionistId: 'n1', date: d(2026, 6, 6).toISOString() }, // offset 0
      { nutritionistId: 'n1', date: d(2026, 7, 1).toISOString() }, // offset 1
    ]);
    mockDb.mealPlan.findMany.mockResolvedValue([
      { nutritionistId: 'n2', createdAt: d(2026, 6, 21) }, // offset 0
    ]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([
      {
        cohortMonth: '2026-06',
        cohortSize: 2,
        retention: [
          { offset: 0, pct: 100 },  // n1 e n2 ativos em junho
          { offset: 1, pct: 50 },   // só n1 ativo em julho
          { offset: 2, pct: 0 },    // ninguém ativo em agosto
          { offset: 3, pct: 0 },    // ninguém ativo em setembro
        ],
      },
    ]);
  });

  it('não inclui offsets cujo mês ainda não chegou (sistema em 2026-09-15, cohort de agosto)', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([{ id: 'n1', createdAt: d(2026, 8, 1) }]);
    mockDb.consultation.findMany.mockResolvedValue([]);
    mockDb.mealPlan.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 8, 1), d(2026, 8, 31));

    // offset 0 = agosto (passado), offset 1 = setembro (mês corrente, já conta),
    // offset 2 = outubro (futuro, não incluído)
    expect(result[0].retention.map((r) => r.offset)).toEqual([0, 1]);
  });

  it('cohort sem nenhum nutricionista cadastrado retorna cohortSize 0 e retention vazio', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ cohortMonth: '2026-06', cohortSize: 0, retention: [] }]);
  });

  it('range misto: um mês com cadastro tem retention normal, outro mês do mesmo range sem cadastro também retorna retention vazio', async () => {
    // Antes da correção, um cohort-mês vazio DENTRO de um range com outros meses com
    // cadastro caía no loop geral e emitia {offset, pct: 0} pra cada offset (shape
    // diferente do early-return de dataset inteiro vazio). Agora os dois casos devem
    // produzir o mesmo shape: retention: [].
    mockDb.nutritionist.findMany.mockResolvedValue([{ id: 'n1', createdAt: d(2026, 6, 10) }]);
    mockDb.consultation.findMany.mockResolvedValue([
      { nutritionistId: 'n1', date: d(2026, 6, 12).toISOString() },
    ]);
    mockDb.mealPlan.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 6, 1), d(2026, 7, 31));

    const juneCohort = result.find((r) => r.cohortMonth === '2026-06');
    const julyCohort = result.find((r) => r.cohortMonth === '2026-07');

    expect(juneCohort?.cohortSize).toBe(1);
    expect(juneCohort?.retention[0]).toEqual({ offset: 0, pct: 100 });
    expect(julyCohort).toEqual({ cohortMonth: '2026-07', cohortSize: 0, retention: [] });
  });

  it('cohort perto de virada de ano: offset 2 (novembro 2026 + 2 = janeiro 2027) marca retido com atividade em jan/2027', async () => {
    // Sistema fixado em 2027-02-15 — offsets 0-3 já estão no passado
    vi.setSystemTime(d(2027, 2, 15));

    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: 'n-nov', createdAt: d(2026, 11, 5) },
    ]);
    mockDb.consultation.findMany.mockResolvedValue([
      { nutritionistId: 'n-nov', date: d(2027, 1, 10).toISOString() }, // offset 2 (jan/2027)
    ]);
    mockDb.mealPlan.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 11, 1), d(2026, 11, 30));

    // Prova que Date.UTC(2026, 11 - 1 + 2, 1) = Date.UTC(2026, 12, 1) corretamente
    // normaliza para janeiro de 2027, e a atividade em janeiro é encontrada.
    expect(result).toEqual([
      {
        cohortMonth: '2026-11',
        cohortSize: 1,
        retention: [
          { offset: 0, pct: 0 },   // nenhuma atividade em nov/2026
          { offset: 1, pct: 0 },   // nenhuma atividade em dez/2026
          { offset: 2, pct: 100 }, // atividade em jan/2027 (ano mudou, verificação de overflow)
          { offset: 3, pct: 0 },   // nenhuma atividade em fev/2027
        ],
      },
    ]);
  });
});

describe('AdminStatsService.getActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 9, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna grid completo de 168 células (7x24) e agrega dois agendamentos na mesma célula shiftada pra horário de Brasília', async () => {
    // 13:15 e 13:45 UTC caem ambos em 10h no fuso de São Paulo (UTC-3), mesma célula.
    mockDb.appointment.findMany.mockResolvedValue([
      { date: new Date('2026-09-14T13:15:00.000Z') },
      { date: new Date('2026-09-14T13:45:00.000Z') },
    ]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    expect(result).toHaveLength(168);
    const shifted = new Date(new Date('2026-09-14T13:15:00.000Z').getTime() - 3 * 60 * 60 * 1000);
    const cell = result.find((p) => p.day === shifted.getUTCDay() && p.hour === shifted.getUTCHours());
    expect(cell?.count).toBe(2);
  });

  it('desloca o dia pro anterior quando o shift de -3h cruza a meia-noite UTC', async () => {
    // 01:00 UTC de uma segunda-feira - 3h = 22:00 UTC de domingo (dia anterior, horário
    // de Brasília) — o shift precisa mover a Date inteira, não hora e dia separadamente.
    mockDb.appointment.findMany.mockResolvedValue([{ date: new Date('2026-09-14T01:00:00.000Z') }]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    const expectedShifted = new Date('2026-09-13T22:00:00.000Z');
    const cell = result.find((p) => p.day === expectedShifted.getUTCDay() && p.hour === 22);
    expect(cell?.count).toBe(1);

    // Não deve ter caído na célula do dia/hora UTC original (01h UTC, dia 14).
    const utcDate = new Date('2026-09-14T01:00:00.000Z');
    const utcCell = result.find((p) => p.day === utcDate.getUTCDay() && p.hour === 1);
    expect(utcCell?.count).toBe(0);
  });

  it('filtra deletedAt e usa uma janela de 90 dias terminando em "agora", sem consultar Consultation', async () => {
    mockDb.appointment.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    expect(mockDb.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(mockDb.consultation.findMany).not.toHaveBeenCalled();
    expect(result.every((p) => p.count === 0)).toBe(true);
  });

  it('ignora agendamentos com date inválida', async () => {
    mockDb.appointment.findMany.mockResolvedValue([{ date: new Date('data-invalida') }]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    expect(result.every((p) => p.count === 0)).toBe(true);
  });
});
