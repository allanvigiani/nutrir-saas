import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDeleteMany } = vi.hoisted(() => ({
  mockDeleteMany: vi.fn(),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    patient: { deleteMany: mockDeleteMany },
  },
}));

import { createRetentionService } from '../../server/services/retention.service.ts';

const service = createRetentionService({ prisma: {} as any });

describe('RetentionService.cleanupSoftDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 3 });
  });

  it('deleta somente pacientes com deletedAt antes da data de corte', async () => {
    await service.cleanupSoftDeleted(30);
    const call = mockDeleteMany.mock.calls[0][0];
    expect(call.where.deletedAt.lt).toBeInstanceOf(Date);
  });

  it('retorna o número de registros deletados', async () => {
    const result = await service.cleanupSoftDeleted(30);
    expect(result).toEqual({ deletedCount: 3 });
  });
});
