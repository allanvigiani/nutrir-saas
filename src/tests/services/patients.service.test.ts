import { describe, it, expect, vi } from 'vitest';
import { createPatientsService } from '../../server/services/patients.service.ts';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    patient: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'pat1' }),
      update: vi.fn().mockResolvedValue({ id: 'pat1' }),
      delete: vi.fn().mockResolvedValue({ id: 'pat1' }),
      ...overrides.patient,
    },
  };
}

describe('PatientsService', () => {
  it('list retorna pacientes do nutricionista ordenados por createdAt desc', async () => {
    const prisma = makePrisma();
    const service = createPatientsService({ prisma: prisma as any });
    await service.list('uid1');
    expect(prisma.patient.findMany).toHaveBeenCalledWith({
      where: { nutritionistId: 'uid1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('create associa nutritionistId ao paciente', async () => {
    const created = { id: 'pat1', nutritionistId: 'uid1', name: 'João' };
    const prisma = makePrisma({ patient: { create: vi.fn().mockResolvedValue(created) } });
    const service = createPatientsService({ prisma: prisma as any });
    const result = await service.create('uid1', { name: 'João', email: 'joao@test.com' } as any);
    expect(result.nutritionistId).toBe('uid1');
  });

  it('remove lança erro se paciente não pertence ao nutricionista', async () => {
    const prisma = makePrisma();
    const service = createPatientsService({ prisma: prisma as any });
    await expect(service.remove('uid1', 'pat-other')).rejects.toThrow('Não autorizado');
  });
});
