import { describe, it, expect, vi, beforeEach } from 'vitest';

const mealPlan = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() };
const mealPlanItem = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() };

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({ mealPlan, mealPlanItem }),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
    mealPlanItem: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxMealPlans: 1 },
}));

import { createMealPlansService } from '../../server/services/meal-plans.service.ts';

const service = createMealPlansService();

describe('meal-plans.service — soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() filtra planos com deletedAt preenchido', async () => {
    mealPlan.findMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mealPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('getOne() filtra planos com deletedAt preenchido', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null, items: [] });
    await service.getOne('nutri-1', 'mp-1');
    expect(mealPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete do plano em vez de deletar', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });
    mealPlan.update.mockResolvedValue({});
    await service.remove('nutri-1', 'mp-1');
    expect(mealPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mealPlan.delete).not.toHaveBeenCalled();
  });

  it('update() lança erro se plano foi soft-deleted', async () => {
    mealPlan.findFirst.mockResolvedValue(null);
    await expect(service.update('nutri-1', 'mp-deleted', { name: 'Novo' }))
      .rejects.toThrow('Não autorizado');
  });

  it('count de plano free exclui planos soft-deleted', async () => {
    mealPlan.count.mockResolvedValue(0);
    mealPlan.create.mockResolvedValue({ id: 'mp-new' });
    await service.create('nutri-1', 'pac-1', { name: 'Plano A', status: 'active' }, false);
    expect(mealPlan.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
