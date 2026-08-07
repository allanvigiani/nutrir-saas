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

  it('atualiza e retorna nutricionista quando uid existe', async () => {
    const existing = { id: 'uid1' };
    const updated = { id: 'uid1', name: 'Ana Silva', email: 'ana@test.com', plan: 'free' };
    mockFindUnique.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(updated);
    const result = await service.updateMe('uid1', { name: 'Ana Silva' });
    expect(result).toEqual(updated);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'uid1' }, select: { id: true } });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'uid1' },
      data: expect.objectContaining({ name: 'Ana Silva', updatedAt: expect.any(Date) }),
    });
  });

  it('lança erro "Nutricionista não encontrado" quando uid não existe no PostgreSQL', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(service.updateMe('uid-inexistente', { name: 'X' }))
      .rejects.toThrow('Nutricionista não encontrado');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('propaga erro inesperado do Prisma sem mascarar', async () => {
    const dbError = new Error('Connection refused');
    mockFindUnique.mockRejectedValue(dbError);
    await expect(service.updateMe('uid1', { name: 'X' })).rejects.toThrow('Connection refused');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('propaga erro do Prisma no update após findUnique bem-sucedido', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uid1' });
    mockUpdate.mockRejectedValue(new Error('unique constraint violation'));
    await expect(service.updateMe('uid1', { crn: 'duplicado' })).rejects.toThrow('unique constraint violation');
  });
});
