import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  nutritionist: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  patient: {
    count: vi.fn(),
  },
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  withAdminRLS: vi.fn((fn: () => Promise<any>) => fn()),
  getDb: vi.fn(() => mockDb),
}));

import { createAdminService } from '../../server/services/admin.service.ts';

describe('AdminService.getStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula conversão e receita paga corretamente', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(3)    // premium
      .mockResolvedValueOnce(2)    // payingPremium (asaasStatus pagante)
      .mockResolvedValueOnce(1)    // admin
      .mockResolvedValueOnce(7)    // active last 30 days
      .mockResolvedValueOnce(2);   // new last 7 days
    mockDb.patient.count.mockResolvedValue(50);

    const service = createAdminService();
    const stats = await service.getStats();

    expect(stats.totalNutritionists).toBe(10);
    expect(stats.premiumCount).toBe(3);
    expect(stats.freeCount).toBe(6); // 10 - 3 - 1 = 6
    expect(stats.conversionRate).toBe(30); // 3/10 * 100
    expect(stats.payingPremiumRevenue).toBeCloseTo(79.80); // 2 * 39.90
    expect(stats.totalPatients).toBe(50);
  });

  it('conta payingPremiumRevenue só com assinaturas em status pagante do Asaas', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.patient.count.mockResolvedValue(0);

    const service = createAdminService();
    await service.getStats();

    expect(mockDb.nutritionist.count).toHaveBeenNthCalledWith(3, {
      where: { plan: 'premium', subscription: { asaasStatus: { in: ['CONFIRMED', 'RECEIVED', 'ACTIVE'] } } },
    });
  });

  it('retorna conversionRate 0 quando não há nutricionistas', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.patient.count.mockResolvedValue(0);

    const service = createAdminService();
    const stats = await service.getStats();

    expect(stats.conversionRate).toBe(0);
    expect(stats.payingPremiumRevenue).toBe(0);
  });
});

describe('AdminService.listNutritionists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna página 1 com limit 2 e totalPages correto', async () => {
    mockDb.nutritionist.count.mockResolvedValue(5);
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);

    const service = createAdminService();
    const result = await service.listNutritionists({ page: 1, limit: 2 });

    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
    expect(result.data).toHaveLength(2);
    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 2 })
    );
  });

  it('calcula skip corretamente para página 3', async () => {
    mockDb.nutritionist.count.mockResolvedValue(10);
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionists({ page: 3, limit: 2 });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 4, take: 2 })
    );
  });
});

describe('RetentionService.countPendingDeletion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('conta pacientes com deletedAt há mais de 30 dias', async () => {
    mockDb.patient = { ...mockDb.patient, count: vi.fn().mockResolvedValue(5) };

    const { createRetentionService } = await import('../../server/services/retention.service.ts');
    const service = createRetentionService();
    const result = await service.countPendingDeletion(30);

    expect(result).toBe(5);
    expect(mockDb.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: expect.any(Object) }) })
    );
  });

  it('retorna 0 quando não há pacientes pendentes', async () => {
    mockDb.patient = { ...mockDb.patient, count: vi.fn().mockResolvedValue(0) };

    const { createRetentionService } = await import('../../server/services/retention.service.ts');
    const service = createRetentionService();
    const result = await service.countPendingDeletion(30);

    expect(result).toBe(0);
  });
});

describe('AdminService.getExpandedStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna métricas expandidas com novos assinantes e consultas do mês', async () => {
    // getExpandedStats chama getStats() internamente, que faz 6 chamadas sequenciais a
    // nutritionist.count: total, premium, payingPremium, admin, activeLast30, newLast7 —
    // ver admin.service.ts#getStats. Faltando uma dessas 6 aqui, todo valor a partir da
    // 3ª chamada desliza uma posição (ex.: newLast7Days silenciosamente virava undefined).
    mockDb.nutritionist.count
      .mockResolvedValueOnce(20)  // total
      .mockResolvedValueOnce(5)   // premium
      .mockResolvedValueOnce(4)   // payingPremium
      .mockResolvedValueOnce(1)   // admin
      .mockResolvedValueOnce(12)  // activeLast30
      .mockResolvedValueOnce(3);  // newLast7
    mockDb.patient.count.mockResolvedValue(80);
    (mockDb as any).subscription = {
      count: vi.fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1),
    };
    (mockDb as any).consultation = { count: vi.fn().mockResolvedValue(15) };
    (mockDb as any).mealPlan = { count: vi.fn().mockResolvedValue(8) };

    const service = createAdminService();
    const stats = await service.getExpandedStats();

    expect(stats.totalNutritionists).toBe(20);
    expect(stats.premiumCount).toBe(5);
    expect(stats.newLast7Days).toBe(3); // pega a 6ª chamada de nutritionist.count — regressão do slot faltando
    expect(stats.newSubscribersThisMonth).toBe(2);
    expect(stats.newSubscribersPrevMonth).toBe(1);
    expect(stats.pendingChurn).toBe(1);
    expect(stats.consultationsThisMonth).toBe(15);
    expect(stats.mealPlansThisMonth).toBe(8);
  });
});

describe('AdminService.listNutritionists com filtros de engajamento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inclui subscription e _count.patients no resultado', async () => {
    mockDb.nutritionist.count.mockResolvedValue(1);
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: '1', name: 'A', plan: 'free', lastLogin: new Date().toISOString(),
        _count: { patients: 3 }, subscription: null },
    ]);

    const service = createAdminService();
    const result = await service.listNutritionists({ page: 1, limit: 20 });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ _count: expect.any(Object) }),
      })
    );
    expect(result.data[0]._count.patients).toBe(3);
  });

  it('aplica filtro churnRisk (premium + lastLogin < 30 dias atrás)', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionists({ page: 1, limit: 20, filter: 'churnRisk' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plan: 'premium',
          lastLogin: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    );
  });

  it('aplica filtro atLimit (free com paciente ativo)', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionists({ page: 1, limit: 20, filter: 'atLimit' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plan: 'free',
          patients: expect.objectContaining({ some: expect.any(Object) }),
        }),
      })
    );
  });
});

describe('AdminService.listNutritionistsForExport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem filtro, usa where vazio e busca todos os nutricionistas', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionistsForExport({});

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('com filter=atLimit, aplica o mesmo where de listNutritionists', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'A',
        email: 'a@test.com',
        crn: '123',
        plan: 'free',
        role: 'nutritionist',
        createdAt: new Date(),
        lastLogin: null,
        planOverridedByAdmin: false,
        _count: { patients: 3 },
      },
    ]);

    const service = createAdminService();
    const result = await service.listNutritionistsForExport({ filter: 'atLimit' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plan: 'free', patients: { some: { status: 'active', deletedAt: null } } },
      })
    );
    expect(result).toHaveLength(1);
  });

  it('com filter=churnRisk, aplica plan premium e lastLogin antigo', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionistsForExport({ filter: 'churnRisk' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plan: 'premium', lastLogin: { lt: expect.any(Date) } },
      })
    );
  });

  it('não pagina — não passa skip, e limita a 5000 registros via take', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionistsForExport({});

    const callArgs = mockDb.nutritionist.findMany.mock.calls[0][0];
    expect(callArgs.skip).toBeUndefined();
    expect(callArgs.take).toBe(5000);
  });
});

describe('AdminService.getOperationalData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna contagens e lista de planos manuais', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(3)  // noCpfCnpjCount
      .mockResolvedValueOnce(2); // noPatientsCount
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: '1', name: 'Admin Test', email: 'a@b.com', plan: 'premium', updatedAt: new Date().toISOString() },
    ]);

    const service = createAdminService();
    const result = await service.getOperationalData();

    expect(result.noCpfCnpjCount).toBe(3);
    expect(result.noPatientsCount).toBe(2);
    expect(result.manualPlanOverrides).toHaveLength(1);
    expect(result.manualPlanOverrides[0].name).toBe('Admin Test');
  });
});

describe('AdminService.logAudit + getAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logAudit cria registro no banco com os dados corretos', async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    (mockDb as any).adminAuditLog = { create: mockCreate, findMany: vi.fn().mockResolvedValue([]) };

    const service = createAdminService();
    await service.logAudit({
      adminId: 'admin1',
      adminEmail: 'admin@test.com',
      action: 'set_plan',
      targetId: 'user1',
      targetEmail: 'user@test.com',
      previousValue: 'free',
      newValue: 'premium',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: 'admin1',
        action: 'set_plan',
        newValue: 'premium',
      }),
    });
  });

  it('getAuditLogs retorna registros em ordem decrescente com limit 50', async () => {
    const mockLogs = [{ id: '1', action: 'set_plan', createdAt: new Date().toISOString() }];
    (mockDb as any).adminAuditLog = {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue(mockLogs),
    };

    const service = createAdminService();
    const logs = await service.getAuditLogs(50);

    expect(logs).toEqual(mockLogs);
    expect((mockDb as any).adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 50 })
    );
  });
});

describe('AdminService.getNutritionistById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca por id com o mesmo include (_count.patients, subscription) de listNutritionists', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({ id: 'n1', name: 'Nutri', plan: 'premium' });

    const service = createAdminService();
    const result = await service.getNutritionistById('n1');

    expect(mockDb.nutritionist.findUnique).toHaveBeenCalledWith({
      where: { id: 'n1' },
      include: {
        _count: { select: { patients: true } },
        subscription: { select: { cancelAtPeriodEnd: true, asaasStatus: true, currentPeriodEnd: true } },
      },
    });
    expect(result).toEqual({ id: 'n1', name: 'Nutri', plan: 'premium' });
  });

  it('retorna null quando o id não existe', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue(null);

    const service = createAdminService();
    const result = await service.getNutritionistById('inexistente');

    expect(result).toBeNull();
  });
});

describe('AdminService.updateNutritionistProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna null quando o id não existe', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue(null);

    const service = createAdminService();
    const result = await service.updateNutritionistProfile('id-inexistente', { name: 'Novo Nome' });

    expect(result).toBeNull();
    expect(mockDb.nutritionist.update).not.toHaveBeenCalled();
  });

  it('atualiza só os campos que de fato mudaram e retorna o diff', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({
      email: 'nutri@test.com',
      name: 'Nome Antigo',
      crn: 'CRN123',
      phone: '11999999999',
      plan: 'free',
    });
    mockDb.nutritionist.update.mockResolvedValue({ id: 'n1', name: 'Nome Novo' });

    const service = createAdminService();
    const result = await service.updateNutritionistProfile('n1', {
      name: 'Nome Novo',
      crn: 'CRN123', // igual ao atual — não deve gerar diff
    });

    expect(mockDb.nutritionist.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { name: 'Nome Novo' },
    });
    expect(result?.changes).toEqual([
      { field: 'name', previousValue: 'Nome Antigo', newValue: 'Nome Novo' },
    ]);
    expect(result?.email).toBe('nutri@test.com');
  });

  it('não chama update() quando nenhum campo enviado difere do valor atual', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({
      email: 'nutri@test.com',
      name: 'Mesmo Nome',
      crn: null,
      phone: null,
      plan: 'free',
    });

    const service = createAdminService();
    const result = await service.updateNutritionistProfile('n1', { name: 'Mesmo Nome' });

    expect(mockDb.nutritionist.update).not.toHaveBeenCalled();
    expect(result?.changes).toEqual([]);
  });

  it('marca planOverridedByAdmin=true quando o plano muda', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({
      email: 'nutri@test.com',
      name: 'Nutri',
      crn: null,
      phone: null,
      plan: 'free',
    });
    mockDb.nutritionist.update.mockResolvedValue({ id: 'n1', plan: 'premium' });

    const service = createAdminService();
    const result = await service.updateNutritionistProfile('n1', { plan: 'premium' });

    expect(mockDb.nutritionist.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { plan: 'premium', planOverridedByAdmin: true },
    });
    expect(result?.changes).toEqual([
      { field: 'plan', previousValue: 'free', newValue: 'premium' },
    ]);
  });

  it('não marca planOverridedByAdmin quando plan é enviado mas igual ao atual', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({
      email: 'nutri@test.com',
      name: 'Nutri',
      crn: null,
      phone: null,
      plan: 'premium',
    });

    const service = createAdminService();
    await service.updateNutritionistProfile('n1', { plan: 'premium' });

    expect(mockDb.nutritionist.update).not.toHaveBeenCalled();
  });

  it('gera diff para múltiplos campos alterados na mesma chamada', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({
      email: 'nutri@test.com',
      name: 'Nome Antigo',
      crn: 'CRN1',
      phone: '111',
      plan: 'free',
    });
    mockDb.nutritionist.update.mockResolvedValue({ id: 'n1' });

    const service = createAdminService();
    const result = await service.updateNutritionistProfile('n1', {
      name: 'Nome Novo',
      phone: '222',
      plan: 'premium',
    });

    expect(result?.changes).toHaveLength(3);
    expect(result?.changes.map((c) => c.field).sort()).toEqual(['name', 'phone', 'plan']);
  });

  it('nunca aplica campos fora da allowlist (email/id/role/cpf/cnpj), mesmo que presentes no objeto de input', async () => {
    mockDb.nutritionist.findUnique.mockResolvedValue({
      email: 'nutri@test.com',
      name: 'Nome',
      crn: null,
      phone: null,
      plan: 'free',
    });
    mockDb.nutritionist.update.mockResolvedValue({ id: 'n1' });

    const service = createAdminService();
    // Simula um input que, por bug do caller, ainda contivesse campos fora da allowlist —
    // a service só lê os campos declarados em EDITABLE_PROFILE_FIELDS.
    await service.updateNutritionistProfile('n1', {
      name: 'Novo Nome',
      ...( { email: 'hacker@test.com', role: 'admin', id: 'outro-id' } as any),
    });

    const dataEnviada = mockDb.nutritionist.update.mock.calls[0][0].data;
    expect(dataEnviada.email).toBeUndefined();
    expect(dataEnviada.role).toBeUndefined();
    expect(dataEnviada.id).toBeUndefined();
  });
});

describe('AdminService.getAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa os 4 tipos de alerta com o detail correto', async () => {
    const now = new Date();
    const lastLogin35DaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    // Usa 5 dias para evitar edge cases de day boundaries
    const graceEndsIn5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    mockDb.nutritionist.findMany
      .mockResolvedValueOnce([
        { id: 'n1', name: 'Churn Risk', email: 'churn@test.com', lastLogin: lastLogin35DaysAgo.toISOString() },
      ]) // churnRisk
      .mockResolvedValueOnce([
        { id: 'n2', name: 'At Limit', email: 'atlimit@test.com' },
      ]) // atLimit
      .mockResolvedValueOnce([
        { id: 'n3', name: 'Grace Ending', email: 'grace@test.com', gracePeriodEndAt: graceEndsIn5Days },
      ]) // gracePeriodEnding
      .mockResolvedValueOnce([
        { id: 'n4', name: 'Payment Issue', email: 'payment@test.com', subscription: { asaasStatus: 'OVERDUE' } },
      ]); // paymentIssue

    const service = createAdminService();
    const alerts = await service.getAlerts();

    expect(alerts).toEqual([
      { type: 'churnRisk', nutritionistId: 'n1', name: 'Churn Risk', email: 'churn@test.com', detail: 'Sem login há 35 dias' },
      { type: 'atLimit', nutritionistId: 'n2', name: 'At Limit', email: 'atlimit@test.com', detail: 'Plano gratuito com paciente ativo' },
      { type: 'gracePeriodEnding', nutritionistId: 'n3', name: 'Grace Ending', email: 'grace@test.com', detail: 'Período de carência termina em 5 dia(s)' },
      { type: 'paymentIssue', nutritionistId: 'n4', name: 'Payment Issue', email: 'payment@test.com', detail: 'Status Asaas: OVERDUE' },
    ]);
  });

  it('nutricionista com lastLogin nulo recebe detail "Nunca fez login"', async () => {
    mockDb.nutritionist.findMany
      .mockResolvedValueOnce([{ id: 'n1', name: 'A', email: 'a@test.com', lastLogin: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const service = createAdminService();
    const alerts = await service.getAlerts();

    expect(alerts).toEqual([
      { type: 'churnRisk', nutritionistId: 'n1', name: 'A', email: 'a@test.com', detail: 'Nunca fez login' },
    ]);
  });

  it('retorna array vazio quando não há nenhum alerta', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    const alerts = await service.getAlerts();

    expect(alerts).toEqual([]);
  });

  it('filtra gracePeriodEnding pra janela de 7 dias e paymentIssue pra status OVERDUE/PENDING', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.getAlerts();

    // 3ª chamada = gracePeriodEnding
    expect(mockDb.nutritionist.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: { gracePeriodEndAt: { gte: expect.any(Date), lte: expect.any(Date) } },
    }));
    // 4ª chamada = paymentIssue
    expect(mockDb.nutritionist.findMany).toHaveBeenNthCalledWith(4, expect.objectContaining({
      where: { subscription: { asaasStatus: { in: ['OVERDUE', 'PENDING'] } } },
    }));
  });
});
