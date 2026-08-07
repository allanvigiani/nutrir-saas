import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted garante que as variáveis existam antes do hoisting do vi.mock
const { mockPrismaTransaction, mockPrismaDeleteMany, mockPrismaCreate } = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockPrismaDeleteMany: vi.fn(),
  mockPrismaCreate: vi.fn(),
}));

const mealPlan = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() };
const mealPlanItem = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() };

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({ mealPlan, mealPlanItem }),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    $transaction: mockPrismaTransaction,
    mealPlanItem: { deleteMany: mockPrismaDeleteMany, create: mockPrismaCreate },
  },
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxMealPlans: 1 },
}));

import { createMealPlansService } from '../../server/services/meal-plans.service.ts';

// Helper: cria item de plano alimentar base (payload do frontend — snake_case)
function criarItemBase(overrides: Record<string, unknown> = {}) {
  return {
    meal: 'cafe-da-manha',
    food: 'Arroz integral',
    quantity: 100,
    unit: 'g',
    kcal: 130,
    protein: 2.7,
    carbs: 28,
    fat: 1,
    position: 0,
    base_kcal: 130,
    base_protein: 2.7,
    base_carbs: 28,
    base_fat: 1,
    base_quantity: 100,
    serving_name: null,
    serving_weight: null,
    ...overrides,
  };
}

// Helper: cria item retornado pelo banco (camelCase — como Prisma retorna)
function criarItemDb(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    mealPlanId: 'mp-1',
    nutritionistId: 'nutri-1',
    meal: 'cafe-da-manha',
    food: 'Arroz integral',
    quantity: 100,
    unit: 'g',
    kcal: 130,
    protein: 2.7,
    carbs: 28,
    fat: 1,
    baseKcal: 130,
    baseProtein: 2.7,
    baseCarbs: 28,
    baseFat: 1,
    baseQuantity: 100,
    servingName: null,
    servingWeight: null,
    position: 0,
    ...overrides,
  };
}

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

describe('meal-plans.service — position / reordenação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaTransaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
    mockPrismaDeleteMany.mockResolvedValue({});
    mockPrismaCreate.mockResolvedValue({});
  });

  describe('getOne', () => {
    it('ordena itens por position asc, id asc na query', async () => {
      mealPlan.findFirst.mockResolvedValue({
        id: 'mp-1',
        nutritionistId: 'nutri-1',
        deletedAt: null,
        items: [],
      });

      await service.getOne('nutri-1', 'mp-1');

      expect(mealPlan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            items: {
              orderBy: [{ position: 'asc' }, { id: 'asc' }],
            },
          },
        }),
      );
    });

    it('expõe campo position em cada item serializado', async () => {
      mealPlan.findFirst.mockResolvedValue({
        id: 'mp-1',
        nutritionistId: 'nutri-1',
        patientId: 'pac-1',
        deletedAt: null,
        items: [criarItemDb({ position: 2 })],
      });

      const result = await service.getOne('nutri-1', 'mp-1') as any;
      expect(result.items[0].position).toBe(2);
    });

    it('usa position 0 como fallback quando banco retorna item sem position', async () => {
      const itemSemPosition = criarItemDb();
      delete (itemSemPosition as any).position;

      mealPlan.findFirst.mockResolvedValue({
        id: 'mp-1',
        nutritionistId: 'nutri-1',
        patientId: 'pac-1',
        deletedAt: null,
        items: [itemSemPosition],
      });

      const result = await service.getOne('nutri-1', 'mp-1') as any;
      expect(result.items[0].position).toBe(0);
    });

    it('lança erro quando plano não encontrado', async () => {
      mealPlan.findFirst.mockResolvedValue(null);
      await expect(service.getOne('nutri-1', 'mp-inexistente')).rejects.toThrow('Plano não encontrado');
    });
  });

  describe('listItems', () => {
    it('ordena itens por position asc, id asc na query', async () => {
      mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1' });
      mealPlanItem.findMany.mockResolvedValue([]);

      await service.listItems('nutri-1', 'mp-1');

      expect(mealPlanItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('lança erro quando plano não encontrado ou não autorizado', async () => {
      mealPlan.findFirst.mockResolvedValue(null);
      await expect(service.listItems('nutri-1', 'mp-1')).rejects.toThrow('Não autorizado');
    });
  });

  describe('replaceItems', () => {
    it('persiste position de cada item conforme payload', async () => {
      mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });

      const itens = [
        criarItemBase({ meal: 'cafe-da-manha', position: 0 }),
        criarItemBase({ meal: 'cafe-da-manha', food: 'Banana', position: 1 }),
        criarItemBase({ meal: 'almoco', position: 0 }),
      ];

      await service.replaceItems('nutri-1', 'mp-1', itens);

      expect(mockPrismaCreate).toHaveBeenCalledTimes(3);
      const positionsCriadas = mockPrismaCreate.mock.calls.map(
        (c: unknown[]) => (c[0] as { data: { position: number } }).data.position,
      );
      expect(positionsCriadas).toEqual([0, 1, 0]);
    });

    it('usa position 0 como fallback quando item não informa position', async () => {
      mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });

      const itemSemPosition = criarItemBase();
      delete (itemSemPosition as any).position;

      await service.replaceItems('nutri-1', 'mp-1', [itemSemPosition]);

      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ position: 0 }) }),
      );
    });

    it('executa deleteMany antes de criar novos itens (substituição atômica)', async () => {
      mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });

      await service.replaceItems('nutri-1', 'mp-1', [criarItemBase()]);

      expect(mockPrismaDeleteMany).toHaveBeenCalledWith({ where: { mealPlanId: 'mp-1' } });
      expect(mockPrismaTransaction).toHaveBeenCalled();
    });

    it('lança erro quando plano não existe ou não autorizado', async () => {
      mealPlan.findFirst.mockResolvedValue(null);
      await expect(service.replaceItems('nutri-1', 'mp-1', [])).rejects.toThrow('Não autorizado');
    });

    it('aceita lista vazia de itens (limpa todos os itens do plano)', async () => {
      mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });

      await service.replaceItems('nutri-1', 'mp-1', []);

      expect(mockPrismaDeleteMany).toHaveBeenCalledWith({ where: { mealPlanId: 'mp-1' } });
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    it('position 1 no payload resulta em position 1 persistido (service é correto, bug está no frontend)', async () => {
      // Documenta que o service persiste o position recebido sem alteração.
      // O bug crítico está em MealPlanEdit.tsx:110-111 onde o position calculado
      // é sobrescrito pelo position original do item via Object.entries spread.
      mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });

      await service.replaceItems('nutri-1', 'mp-1', [criarItemBase({ position: 1 })]);

      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ position: 1 }) }),
      );
    });
  });
});
