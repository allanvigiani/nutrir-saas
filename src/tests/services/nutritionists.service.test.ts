import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate:     vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    nutritionist: {
      findUnique: mockFindUnique,
      update:     mockUpdate,
    },
  }),
}));

import { createNutritionistsService } from '../../server/services/nutritionists.service.ts';

const service = createNutritionistsService();

describe('NutritionistsService.getMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna o nutricionista pelo uid', async () => {
    const nutritionist = { id: 'uid1', name: 'Ana', email: 'ana@test.com', plan: 'free' };
    mockFindUnique.mockResolvedValue(nutritionist);
    const result = await service.getMe('uid1');
    expect(result).toEqual(nutritionist);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'uid1' }, include: { subscription: true } });
  });

  it('lança erro se nutricionista não existe', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(service.getMe('unknown')).rejects.toThrow('Nutricionista não encontrado');
  });
});

describe('NutritionistsService.updateMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atualiza e retorna nutricionista', async () => {
    const updated = { id: 'uid1', name: 'Ana Silva', email: 'ana@test.com', plan: 'free' };
    mockUpdate.mockResolvedValue(updated);
    const result = await service.updateMe('uid1', { name: 'Ana Silva' });
    expect(result).toEqual(updated);
  });
});
