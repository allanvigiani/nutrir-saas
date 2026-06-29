import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: mocks declarados antes do hoisting de vi.mock
const mealPlan = vi.hoisted(() => ({ findMany: vi.fn() }));
const consultation = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({ mealPlan, consultation }),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: { $transaction: vi.fn(), mealPlanItem: { deleteMany: vi.fn(), create: vi.fn() } },
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxMealPlans: 1 },
}));

import { createMealPlansService } from '../../server/services/meal-plans.service.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function criarPlanoDb(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mp-1',
    name: 'Plano Verão',
    patientId: 'pac-1',
    nutritionistId: 'nutri-1',
    consultationId: 'cons-1',
    generalInstructions: 'Beber água',
    waterIntake: '2L',
    mealObservations: { almoco: 'Evitar fritos' },
    customMeals: ['Lanche da tarde'],
    deletedAt: null,
    createdAt: new Date('2026-05-01T10:00:00Z'),
    items: [],
    ...overrides,
  };
}

function criarConsultaDb(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cons-1',
    date: new Date('2026-05-01'),
    ...overrides,
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('meal-plans.service — getHistory', () => {
  let service: ReturnType<typeof createMealPlansService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createMealPlansService();
  });

  describe('happy path', () => {
    it('retorna lista com plano e data da consulta', async () => {
      mealPlan.findMany.mockResolvedValue([criarPlanoDb()]);
      consultation.findMany.mockResolvedValue([criarConsultaDb()]);

      const resultado = await service.getHistory('nutri-1', 'pac-1');

      expect(resultado).toHaveLength(1);
      expect(resultado[0].consultationId).toBe('cons-1');
      expect(resultado[0].mealPlan.name).toBe('Plano Verão');
      expect(resultado[0].mealPlan.generalInstructions).toBe('Beber água');
      expect(resultado[0].mealPlan.waterIntake).toBe('2L');
    });

    it('repassa nutritionistId e patientId corretamente para a query de mealPlan', async () => {
      mealPlan.findMany.mockResolvedValue([]);

      await service.getHistory('nutri-42', 'pac-99');

      expect(mealPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nutritionistId: 'nutri-42',
            patientId: 'pac-99',
            deletedAt: null,
          }),
        }),
      );
    });

    it('filtra consultationId excluído quando excludeConsultationId fornecido', async () => {
      mealPlan.findMany.mockResolvedValue([]);

      await service.getHistory('nutri-1', 'pac-1', 'cons-atual');

      expect(mealPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultationId: { not: 'cons-atual' },
          }),
        }),
      );
    });

    it('quando excludeConsultationId omitido, exclui apenas planos sem consultationId', async () => {
      mealPlan.findMany.mockResolvedValue([]);

      await service.getHistory('nutri-1', 'pac-1');

      expect(mealPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultationId: { not: null },
          }),
        }),
      );
    });

    it('deduplicação: múltiplos planos da mesma consulta retornam apenas o mais recente', async () => {
      // Dois planos da mesma consulta — findMany já retorna ordenado por createdAt desc
      // O primeiro da lista é o mais recente
      mealPlan.findMany.mockResolvedValue([
        criarPlanoDb({ id: 'mp-recente', name: 'Plano Atualizado', createdAt: new Date('2026-05-15') }),
        criarPlanoDb({ id: 'mp-antigo', name: 'Plano Original', createdAt: new Date('2026-05-01') }),
      ]);
      consultation.findMany.mockResolvedValue([criarConsultaDb()]);

      const resultado = await service.getHistory('nutri-1', 'pac-1');

      expect(resultado).toHaveLength(1);
      expect(resultado[0].mealPlan.id).toBe('mp-recente');
      expect(resultado[0].mealPlan.name).toBe('Plano Atualizado');
    });

    it('múltiplas consultas retornam uma entrada por consulta', async () => {
      mealPlan.findMany.mockResolvedValue([
        criarPlanoDb({ id: 'mp-a', name: 'Plano A', consultationId: 'cons-1' }),
        criarPlanoDb({ id: 'mp-b', name: 'Plano B', consultationId: 'cons-2' }),
      ]);
      consultation.findMany.mockResolvedValue([
        criarConsultaDb({ id: 'cons-1', date: new Date('2026-05-01') }),
        criarConsultaDb({ id: 'cons-2', date: new Date('2026-04-01') }),
      ]);

      const resultado = await service.getHistory('nutri-1', 'pac-1');

      expect(resultado).toHaveLength(2);
      const ids = resultado.map(r => r.consultationId);
      expect(ids).toContain('cons-1');
      expect(ids).toContain('cons-2');
    });

    it('serializa items em snake_case com position', async () => {
      const item = {
        id: 'item-1',
        mealPlanId: 'mp-1',
        nutritionistId: 'nutri-1',
        meal: 'almoco',
        food: 'Frango grelhado',
        quantity: '150',
        unit: 'g',
        kcal: 200,
        protein: 30,
        carbs: 0,
        fat: 8,
        baseKcal: 200,
        baseProtein: 30,
        baseCarbs: 0,
        baseFat: 8,
        baseQuantity: 100,
        servingName: null,
        servingWeight: null,
        weightInGrams: 150,
        position: 2,
      };
      mealPlan.findMany.mockResolvedValue([criarPlanoDb({ items: [item] })]);
      consultation.findMany.mockResolvedValue([criarConsultaDb()]);

      const resultado = await service.getHistory('nutri-1', 'pac-1');
      const itemRetornado = resultado[0].mealPlan.items[0];

      expect(itemRetornado).toMatchObject({
        meal: 'almoco',
        food: 'Frango grelhado',
        weight_in_grams: 150,
        position: 2,
        base_kcal: 200,
        base_protein: 30,
      });
      // Garante que não expõe camelCase do Prisma
      expect(itemRetornado).not.toHaveProperty('weightInGrams');
      expect(itemRetornado).not.toHaveProperty('baseKcal');
    });
  });

  describe('casos de borda', () => {
    it('retorna array vazio quando paciente não tem planos', async () => {
      mealPlan.findMany.mockResolvedValue([]);

      const resultado = await service.getHistory('nutri-1', 'pac-sem-planos');

      expect(resultado).toEqual([]);
      // Não deve buscar consultas quando não há planos
      expect(consultation.findMany).not.toHaveBeenCalled();
    });

    it('ignora plano cuja consulta foi soft-deleted (não aparece no batch de consultas)', async () => {
      // Plano existe mas a consulta foi deletada — não aparece no findMany de consultation
      mealPlan.findMany.mockResolvedValue([criarPlanoDb({ consultationId: 'cons-deletada' })]);
      consultation.findMany.mockResolvedValue([]); // consulta não retorna (deletedAt != null)

      const resultado = await service.getHistory('nutri-1', 'pac-1');

      expect(resultado).toEqual([]);
    });

    it('busca consultas usando os IDs únicos dos planos encontrados', async () => {
      mealPlan.findMany.mockResolvedValue([
        criarPlanoDb({ id: 'mp-1', consultationId: 'cons-1' }),
        criarPlanoDb({ id: 'mp-2', consultationId: 'cons-1' }), // mesma consulta
        criarPlanoDb({ id: 'mp-3', consultationId: 'cons-2' }),
      ]);
      consultation.findMany.mockResolvedValue([
        criarConsultaDb({ id: 'cons-1' }),
        criarConsultaDb({ id: 'cons-2', date: new Date('2026-04-01') }),
      ]);

      await service.getHistory('nutri-1', 'pac-1');

      // Deve passar apenas IDs únicos para evitar query redundante
      expect(consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: expect.arrayContaining(['cons-1', 'cons-2']) },
            nutritionistId: 'nutri-1',
            deletedAt: null,
          }),
        }),
      );
      // Array de IDs deve ter 2 elementos únicos (não 3)
      const chamada = consultation.findMany.mock.calls[0][0];
      expect(chamada.where.id.in).toHaveLength(2);
    });
  });

  describe('casos de erro', () => {
    it('propaga erro de banco ao buscar planos', async () => {
      mealPlan.findMany.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.getHistory('nutri-1', 'pac-1')).rejects.toThrow('DB connection lost');
    });

    it('propaga erro de banco ao buscar consultas', async () => {
      mealPlan.findMany.mockResolvedValue([criarPlanoDb()]);
      consultation.findMany.mockRejectedValue(new Error('Timeout'));

      await expect(service.getHistory('nutri-1', 'pac-1')).rejects.toThrow('Timeout');
    });
  });
});
