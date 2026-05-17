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
    payment: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      create:    mockCreate,
      update:    mockUpdate,
      delete:    mockDelete,
    },
  }),
}));

import { createPaymentsService } from '../../server/services/payments.service.ts';

const service = createPaymentsService();

describe('PaymentsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list filtra por nutritionistId e ordena por data desc', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('uid1');
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { nutritionistId: 'uid1' },
      orderBy: { date: 'desc' },
    });
  });

  it('create insere payment com nutritionistId', async () => {
    const created = { id: 'pay1', nutritionistId: 'uid1' };
    mockCreate.mockResolvedValue(created);
    const result = await service.create('uid1', {
      patientId: 'pat1', amount: 150, date: new Date(), method: 'pix', status: 'paid',
    });
    expect(result.nutritionistId).toBe('uid1');
  });

  it('remove lança erro se payment não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('uid1', 'pay-other')).rejects.toThrow('Não autorizado');
  });
});
