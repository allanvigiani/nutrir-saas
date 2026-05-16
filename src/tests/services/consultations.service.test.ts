import { describe, it, expect, vi } from 'vitest';
import { createConsultationsService } from '../../server/services/consultations.service.ts';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    consultation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'c1' }),
      update: vi.fn().mockResolvedValue({ id: 'c1' }),
      delete: vi.fn().mockResolvedValue({ id: 'c1' }),
      ...overrides.consultation,
    },
  };
}

describe('ConsultationsService', () => {
  it('list retorna consultas do paciente ordenadas por data desc', async () => {
    const prisma = makePrisma();
    const service = createConsultationsService({ prisma: prisma as any });
    await service.list('uid1', 'pat1');
    expect(prisma.consultation.findMany).toHaveBeenCalledWith({
      where: { patientId: 'pat1', nutritionistId: 'uid1' },
      orderBy: { date: 'desc' },
    });
  });

  it('remove lança erro se consulta não pertence ao nutricionista', async () => {
    const prisma = makePrisma();
    const service = createConsultationsService({ prisma: prisma as any });
    await expect(service.remove('uid1', 'c-other')).rejects.toThrow('Não autorizado');
  });
});
