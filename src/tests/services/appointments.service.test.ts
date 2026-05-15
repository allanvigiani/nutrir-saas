import { describe, it, expect, vi } from 'vitest';
import { createAppointmentsService } from '../../server/services/appointments.service.ts';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    appointment: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'apt1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'apt1' }),
      delete: vi.fn().mockResolvedValue({ id: 'apt1' }),
      ...overrides.appointment,
    },
  };
}

describe('AppointmentsService', () => {
  it('list retorna agendamentos do nutricionista ordenados por data', async () => {
    const prisma = makePrisma();
    const service = createAppointmentsService({ prisma: prisma as any });
    await service.list('uid1');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: { nutritionistId: 'uid1' },
      orderBy: { date: 'asc' },
      include: { patient: { select: { name: true } } },
    });
  });

  it('create inclui nutritionistId', async () => {
    const prisma = makePrisma({ appointment: { create: vi.fn().mockResolvedValue({ id: 'apt1', nutritionistId: 'uid1' }) } });
    const service = createAppointmentsService({ prisma: prisma as any });
    const result = await service.create('uid1', { patientId: 'pat1', date: new Date(), status: 'confirmed' });
    expect(result.nutritionistId).toBe('uid1');
  });

  it('remove lança erro se agendamento não pertence ao nutricionista', async () => {
    const prisma = makePrisma();
    const service = createAppointmentsService({ prisma: prisma as any });
    await expect(service.remove('uid1', 'apt-other')).rejects.toThrow('Não autorizado');
  });
});
