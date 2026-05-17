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
    nutritionCalculation: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  }),
}));

import { createNutritionCalculationsService } from '../../server/services/nutrition-calculations.service.ts';

const service = createNutritionCalculationsService();

describe('nutrition-calculations.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra cálculos com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'calc-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'calc-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se cálculo não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'calc-outro')).rejects.toThrow('Não autorizado');
  });
});
