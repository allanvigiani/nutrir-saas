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
    consultation: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      create:    mockCreate,
      update:    mockUpdate,
      delete:    mockDelete,
    },
  }),
}));

import { createConsultationsService } from '../../server/services/consultations.service.ts';

const service = createConsultationsService();

describe('ConsultationsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list retorna consultas do paciente ordenadas por data desc', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('uid1', 'pat1');
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { patientId: 'pat1', nutritionistId: 'uid1' },
      orderBy: { date: 'desc' },
    });
  });

  it('remove lança erro se consulta não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('uid1', 'c-other')).rejects.toThrow('Não autorizado');
  });
});
