import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  nutritionist: {
    count: vi.fn(),
    findMany: vi.fn(),
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

  it('calcula conversão e receita corretamente', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(3)    // premium
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
    expect(stats.estimatedRevenue).toBeCloseTo(119.70); // 3 * 39.90
    expect(stats.totalPatients).toBe(50);
  });

  it('retorna conversionRate 0 quando não há nutricionistas', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.patient.count.mockResolvedValue(0);

    const service = createAdminService();
    const stats = await service.getStats();

    expect(stats.conversionRate).toBe(0);
    expect(stats.estimatedRevenue).toBe(0);
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
    mockDb.nutritionist.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3);
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
