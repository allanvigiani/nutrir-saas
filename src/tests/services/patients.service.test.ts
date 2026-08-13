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
    patient: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
      count:     mockCount,
    },
  }),
}));

import { createPatientsService } from '../../server/services/patients.service.ts';

const service = createPatientsService();

describe('patients.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra pacientes com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', false);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('getOne() filtra pacientes com deletedAt preenchido', async () => {
    mockFindFirst.mockResolvedValue({ id: 'p-1', nutritionistId: 'nutri-1', deletedAt: null });
    await service.getOne('nutri-1', 'p-1');
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete (seta deletedAt) em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'p-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'p-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se paciente não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'p-outro')).rejects.toThrow('Não autorizado');
  });
});

describe('patients.service — proteção contra mass assignment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create() ignora accessToken/id/nutritionistId/deletedAt vindos do body', async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({});
    await service.create('nutri-1', {
      name: 'Paciente X',
      accessToken: 'token-escolhido-pelo-cliente',
      id: 'id-forjado',
      nutritionistId: 'outro-nutricionista',
      deletedAt: null,
    }, true);

    const dataEnviada = mockCreate.mock.calls[0][0].data;
    expect(dataEnviada.accessToken).toBeUndefined();
    expect(dataEnviada.id).toBeUndefined();
    expect(dataEnviada.nutritionistId).toBe('nutri-1'); // sempre o autenticado, nunca o do body
    expect(dataEnviada.deletedAt).toBeUndefined();
    expect(dataEnviada.name).toBe('Paciente X');
  });

  it('update() ignora accessToken/id/nutritionistId vindos do body (não deixa reatribuir o paciente)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'p-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.update('nutri-1', 'p-1', {
      name: 'Nome Atualizado',
      accessToken: 'token-escolhido-pelo-cliente',
      nutritionistId: 'outro-nutricionista',
      id: 'outro-id',
    }, false);

    const dataEnviada = mockUpdate.mock.calls[0][0].data;
    expect(dataEnviada.accessToken).toBeUndefined();
    expect(dataEnviada.nutritionistId).toBeUndefined();
    expect(dataEnviada.id).toBeUndefined();
    expect(dataEnviada.name).toBe('Nome Atualizado');
  });
});

describe('PatientsService — grace period e isReadOnly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() sem gracePeriodOver retorna pacientes sem isReadOnly', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', createdAt: new Date('2026-01-03') },
      { id: 'p2', createdAt: new Date('2026-01-02') },
      { id: 'p3', createdAt: new Date('2026-01-01') },
    ]);
    const svc = createPatientsService();
    const result = await svc.list('n1', false);
    expect((result as any[]).every((p: any) => p.isReadOnly === undefined)).toBe(true);
  });

  it('list() com gracePeriodOver marca pacientes excedentes como isReadOnly', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', createdAt: new Date('2026-01-03') },
      { id: 'p2', createdAt: new Date('2026-01-02') },
      { id: 'p3', createdAt: new Date('2026-01-01') },
    ]);
    const svc = createPatientsService();
    const result = await svc.list('n1', true) as any[];
    expect(result[0].isReadOnly).toBe(false);
    expect(result[1].isReadOnly).toBe(false);
    expect(result[2].isReadOnly).toBe(true);
  });

  it('isPatientReadOnly retorna false se gracePeriodOver=false', async () => {
    const svc = createPatientsService();
    const result = await svc.isPatientReadOnly('n1', 'p3', false);
    expect(result).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('isPatientReadOnly retorna true para paciente excedente', async () => {
    mockFindMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const svc = createPatientsService();
    const result = await svc.isPatientReadOnly('n1', 'p3', true);
    expect(result).toBe(true);
  });

  it('isPatientReadOnly retorna false para paciente dentro do limite', async () => {
    mockFindMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const svc = createPatientsService();
    const result = await svc.isPatientReadOnly('n1', 'p1', true);
    expect(result).toBe(false);
  });
});
