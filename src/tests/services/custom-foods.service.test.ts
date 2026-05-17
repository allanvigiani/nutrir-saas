import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockCreate, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate:    vi.fn(),
  mockUpdate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    customFood: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      create:    mockCreate,
      update:    mockUpdate,
      delete:    mockDelete,
    },
  }),
}));

import { createCustomFoodsService } from '../../server/services/custom-foods.service.ts';

const service = createCustomFoodsService();

describe('CustomFoodsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list retorna alimentos do nutricionista', async () => {
    const foods = [{ id: 'f1', name: 'Arroz', nutritionistId: 'uid1' }];
    mockFindMany.mockResolvedValue(foods);
    const result = await service.list('uid1');
    expect(result).toEqual(foods);
    expect(mockFindMany).toHaveBeenCalledWith({ where: { nutritionistId: 'uid1' } });
  });

  it('create insere alimento com nutritionistId', async () => {
    const created = { id: 'f1', name: 'Feijão', nutritionistId: 'uid1' };
    mockCreate.mockResolvedValue(created);
    const result = await service.create('uid1', { name: 'Feijão', kcal: 76, protein: 4.8, carbs: 13.6, fat: 0.5, baseUnit: 'g', baseQuantity: 100 });
    expect(result.nutritionistId).toBe('uid1');
  });

  it('delete lança erro se alimento não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('uid1', 'food-other')).rejects.toThrow('Não autorizado');
  });
});
