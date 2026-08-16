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
    consultation: {
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
  FREE_PLAN_LIMITS: { maxConsultationsPerMonth: 4, maxConsultationsPerPatientPerMonth: 1, historyMonths: 3 },
}));

import { createConsultationsService } from '../../server/services/consultations.service.ts';

const service = createConsultationsService();

describe('consultations.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra consultas com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1', true);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('list() de plano premium não aplica corte de histórico', async () => {
    mockFindMany.mockResolvedValue([{ id: 'c-1' }]);
    const result = await service.list('nutri-1', 'pac-1', true);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ date: expect.anything() }) }),
    );
    expect(mockCount).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [{ id: 'c-1' }], hasHiddenHistory: false });
  });

  it('list() de plano free aplica corte de historyMonths e sinaliza histórico oculto', async () => {
    mockFindMany.mockResolvedValue([{ id: 'c-recente' }]);
    mockCount.mockResolvedValue(3);
    const result = await service.list('nutri-1', 'pac-1', false);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: { gt: expect.any(String) } }) }),
    );
    expect(result).toEqual({ items: [{ id: 'c-recente' }], hasHiddenHistory: true });
  });

  it('list() de plano free sem histórico antigo não sinaliza oculto', async () => {
    mockFindMany.mockResolvedValue([{ id: 'c-1' }]);
    mockCount.mockResolvedValue(1);
    const result = await service.list('nutri-1', 'pac-1', false);
    expect(result.hasHiddenHistory).toBe(false);
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'c-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'c-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se consulta não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'c-outro')).rejects.toThrow('Não autorizado');
  });

  it('update() lança erro se consulta foi soft-deleted', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.update('nutri-1', 'c-deleted', { status: 'cancelada' }))
      .rejects.toThrow('Não autorizado');
  });

  it('count de plano free exclui consultas soft-deleted', async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: 'c-new' });
    await service.create('nutri-1', 'pac-1', { date: '2026-05-17', status: 'realizada' }, false);
    expect(mockCount).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
    expect(mockCount).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
