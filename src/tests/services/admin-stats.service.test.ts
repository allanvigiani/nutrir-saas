import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  payment: { findMany: vi.fn() },
  patient: { findMany: vi.fn() },
  subscription: { findMany: vi.fn() },
  consultation: { findMany: vi.fn() },
  mealPlan: { findMany: vi.fn() },
  nutritionist: { count: vi.fn() },
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
