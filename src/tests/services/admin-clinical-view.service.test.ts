import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  patient: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  consultation: { findMany: vi.fn() },
  mealPlan: { findMany: vi.fn() },
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: vi.fn(() => mockDb),
}));

import { createAdminClinicalViewService } from '../../server/services/admin-clinical-view.service.ts';

describe('AdminClinicalViewService.getNutritionistPatients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pagina corretamente e exclui pacientes soft-deleted', async () => {
    mockDb.patient.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    mockDb.patient.count.mockResolvedValue(45);

    const service = createAdminClinicalViewService();
    const result = await service.getNutritionistPatients('nutri-1', { page: 3, limit: 20 });

    expect(mockDb.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nutritionistId: 'nutri-1', deletedAt: null },
        skip: 40,
        take: 20,
      })
    );
    expect(mockDb.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nutritionistId: 'nutri-1', deletedAt: null } })
    );
    expect(result).toEqual({ data: [{ id: 'p1' }, { id: 'p2' }], total: 45, page: 3, totalPages: 3 });
  });

  it('usa page=1/limit=20 como default quando não informado', async () => {
    mockDb.patient.findMany.mockResolvedValue([]);
    mockDb.patient.count.mockResolvedValue(0);

    const service = createAdminClinicalViewService();
    await service.getNutritionistPatients('nutri-1', {});

    expect(mockDb.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

describe('AdminClinicalViewService.getPatientDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna o paciente com dados do nutricionista dono anexados', async () => {
    mockDb.patient.findFirst.mockResolvedValue({
      id: 'p1',
      name: 'Paciente Teste',
      nutritionist: { id: 'n1', name: 'Nutri', email: 'n@test.com' },
    });

    const service = createAdminClinicalViewService();
    const result = await service.getPatientDetail('p1');

    expect(mockDb.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1', deletedAt: null },
        include: { nutritionist: { select: { id: true, name: true, email: true } } },
      })
    );
    expect(result?.nutritionist.email).toBe('n@test.com');
  });

  it('retorna null (não vaza) quando o paciente está soft-deleted', async () => {
    // findFirst com deletedAt: null no where já filtra isso no banco — aqui simulamos
    // o resultado esperado quando o registro está soft-deleted (não deve ser encontrado).
    mockDb.patient.findFirst.mockResolvedValue(null);

    const service = createAdminClinicalViewService();
    const result = await service.getPatientDetail('p-deletado');

    expect(result).toBeNull();
  });

  it('retorna null quando o id não existe', async () => {
    mockDb.patient.findFirst.mockResolvedValue(null);

    const service = createAdminClinicalViewService();
    const result = await service.getPatientDetail('id-inexistente');

    expect(result).toBeNull();
  });
});

describe('AdminClinicalViewService.patientExists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna true e usa select leve (só id), sem incluir nutricionista', async () => {
    mockDb.patient.findFirst.mockResolvedValue({ id: 'p1' });

    const service = createAdminClinicalViewService();
    const result = await service.patientExists('p1');

    expect(mockDb.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', deletedAt: null },
      select: { id: true },
    });
    expect(result).toBe(true);
  });

  it('retorna false quando o paciente não existe ou está soft-deleted', async () => {
    mockDb.patient.findFirst.mockResolvedValue(null);

    const service = createAdminClinicalViewService();
    const result = await service.patientExists('id-inexistente');

    expect(result).toBe(false);
  });
});

describe('AdminClinicalViewService.getPatientConsultations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca por patientId, exclui deletedAt e ordena por date desc', async () => {
    mockDb.consultation.findMany.mockResolvedValue([{ id: 'c1' }]);

    const service = createAdminClinicalViewService();
    const result = await service.getPatientConsultations('p1');

    expect(mockDb.consultation.findMany).toHaveBeenCalledWith({
      where: { patientId: 'p1', deletedAt: null },
      orderBy: { date: 'desc' },
    });
    expect(result).toEqual([{ id: 'c1' }]);
  });
});

describe('AdminClinicalViewService.getPatientMealPlans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca por patientId, exclui deletedAt e ordena por createdAt desc', async () => {
    mockDb.mealPlan.findMany.mockResolvedValue([{ id: 'mp1' }]);

    const service = createAdminClinicalViewService();
    const result = await service.getPatientMealPlans('p1');

    expect(mockDb.mealPlan.findMany).toHaveBeenCalledWith({
      where: { patientId: 'p1', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'mp1' }]);
  });
});
