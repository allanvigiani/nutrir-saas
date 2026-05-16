import { describe, it, expect, vi } from 'vitest';
import { createPaymentsService } from '../../server/services/payments.service.ts';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    payment: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'pay1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'pay1' }),
      delete: vi.fn().mockResolvedValue({ id: 'pay1' }),
      ...overrides.payment,
    },
  };
}

describe('PaymentsService', () => {
  it('list filtra por nutritionistId e ordena por data desc', async () => {
    const prisma = makePrisma();
    const service = createPaymentsService({ prisma: prisma as any });
    await service.list('uid1');
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { nutritionistId: 'uid1' },
      orderBy: { date: 'desc' },
    });
  });

  it('create insere payment com nutritionistId', async () => {
    const created = { id: 'pay1', nutritionistId: 'uid1' };
    const prisma = makePrisma({ payment: { create: vi.fn().mockResolvedValue(created) } });
    const service = createPaymentsService({ prisma: prisma as any });
    const result = await service.create('uid1', {
      patientId: 'pat1', amount: 150, date: new Date(), method: 'pix', status: 'paid',
    });
    expect(result.nutritionistId).toBe('uid1');
  });

  it('remove lança erro se payment não pertence ao nutricionista', async () => {
    const prisma = makePrisma();
    const service = createPaymentsService({ prisma: prisma as any });
    await expect(service.remove('uid1', 'pay-other')).rejects.toThrow('Não autorizado');
  });
});
