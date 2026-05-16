import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNutritionistsService } from '../../server/services/nutritionists.service.ts';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    nutritionist: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      ...overrides.nutritionist,
    },
  };
}

describe('NutritionistsService.getMe', () => {
  it('retorna o nutricionista pelo uid', async () => {
    const nutritionist = { id: 'uid1', name: 'Ana', email: 'ana@test.com', plan: 'free' };
    const prisma = makePrisma({ nutritionist: { findUnique: vi.fn().mockResolvedValue(nutritionist) } });
    const service = createNutritionistsService({ prisma: prisma as any });
    const result = await service.getMe('uid1');
    expect(result).toEqual(nutritionist);
    expect(prisma.nutritionist.findUnique).toHaveBeenCalledWith({ where: { id: 'uid1' }, include: { subscription: true } });
  });

  it('lança erro se nutricionista não existe', async () => {
    const prisma = makePrisma();
    const service = createNutritionistsService({ prisma: prisma as any });
    await expect(service.getMe('unknown')).rejects.toThrow('Nutricionista não encontrado');
  });
});

describe('NutritionistsService.updateMe', () => {
  it('atualiza e retorna nutricionista', async () => {
    const updated = { id: 'uid1', name: 'Ana Silva', email: 'ana@test.com', plan: 'free' };
    const prisma = makePrisma({ nutritionist: { update: vi.fn().mockResolvedValue(updated) } });
    const service = createNutritionistsService({ prisma: prisma as any });
    const result = await service.updateMe('uid1', { name: 'Ana Silva' });
    expect(result).toEqual(updated);
  });
});
