import { describe, it, expect, vi } from 'vitest';
import { createCustomFoodsService } from '../../server/services/custom-foods.service.ts';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    customFood: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'food1' }),
      update: vi.fn().mockResolvedValue({ id: 'food1' }),
      delete: vi.fn().mockResolvedValue({ id: 'food1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      ...overrides.customFood,
    },
  };
}

describe('CustomFoodsService', () => {
  it('list retorna alimentos do nutricionista', async () => {
    const foods = [{ id: 'f1', name: 'Arroz', nutritionistId: 'uid1' }];
    const prisma = makePrisma({ customFood: { findMany: vi.fn().mockResolvedValue(foods) } });
    const service = createCustomFoodsService({ prisma: prisma as any });
    const result = await service.list('uid1');
    expect(result).toEqual(foods);
    expect(prisma.customFood.findMany).toHaveBeenCalledWith({ where: { nutritionistId: 'uid1' } });
  });

  it('create insere alimento com nutritionistId', async () => {
    const created = { id: 'f1', name: 'Feijão', nutritionistId: 'uid1' };
    const prisma = makePrisma({ customFood: { create: vi.fn().mockResolvedValue(created) } });
    const service = createCustomFoodsService({ prisma: prisma as any });
    const result = await service.create('uid1', { name: 'Feijão', kcal: 76, protein: 4.8, carbs: 13.6, fat: 0.5, baseUnit: 'g', baseQuantity: 100 });
    expect(result.nutritionistId).toBe('uid1');
  });

  it('delete lança erro se alimento não pertence ao nutricionista', async () => {
    const prisma = makePrisma();
    const service = createCustomFoodsService({ prisma: prisma as any });
    await expect(service.remove('uid1', 'food-other')).rejects.toThrow('Não autorizado');
  });
});
