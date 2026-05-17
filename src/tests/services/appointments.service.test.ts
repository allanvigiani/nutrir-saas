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
    appointment: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      create:    mockCreate,
      update:    mockUpdate,
      delete:    mockDelete,
    },
  }),
}));

import { createAppointmentsService } from '../../server/services/appointments.service.ts';

const service = createAppointmentsService();

describe('AppointmentsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list retorna agendamentos do nutricionista ordenados por data', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('uid1');
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { nutritionistId: 'uid1' },
      orderBy: { date: 'asc' },
      include: { patient: { select: { name: true } } },
    });
  });

  it('create inclui nutritionistId', async () => {
    mockCreate.mockResolvedValue({ id: 'apt1', nutritionistId: 'uid1' });
    const result = await service.create('uid1', { patientId: 'pat1', date: new Date(), status: 'confirmed' });
    expect(result.nutritionistId).toBe('uid1');
  });

  it('remove lança erro se agendamento não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('uid1', 'apt-other')).rejects.toThrow('Não autorizado');
  });
});
