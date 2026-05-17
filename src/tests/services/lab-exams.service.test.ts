import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete, mockCount } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
  mockCount:     vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    labExam: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
      count:     mockCount,
    },
  }),
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxExams: 2 },
}));

import { createLabExamsService } from '../../server/services/lab-exams.service.ts';

const service = createLabExamsService();

describe('lab-exams.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra exames com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'e-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'e-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se exame não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'e-outro')).rejects.toThrow('Não autorizado');
  });

  it('update() lança erro se exame foi soft-deleted', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.update('nutri-1', 'e-deleted', { title: 'Novo' }))
      .rejects.toThrow('Não autorizado');
  });

  it('count de plano free exclui exames soft-deleted', async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: 'e-new' });
    await service.create('nutri-1', 'pac-1', { date: '2026-05-17', title: 'Hemograma', markers: [] }, false);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
