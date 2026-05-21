import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    customFood: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  }),
}));

import { createCustomFoodsService } from '../../server/services/custom-foods.service.ts';

const service = createCustomFoodsService();

describe('custom-foods.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra alimentos com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'food-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'food-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se alimento não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'food-outro')).rejects.toThrow('Não autorizado');
  });

  it('update() lança erro se alimento foi soft-deleted', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.update('nutri-1', 'food-deleted', { name: 'Novo' }))
      .rejects.toThrow('Não autorizado');
  });
});
