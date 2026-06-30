import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNutritionController } from '../../server/controllers/nutrition.controller.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(body: Record<string, any> = {}) {
  return { body } as any;
}

function makeNutritionService(result: any = {}) {
  return {
    calculateNutrition: vi.fn().mockReturnValue(result),
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('NutritionController.calculate', () => {
  let res: ReturnType<typeof makeRes>;

  beforeEach(() => {
    res = makeRes();
  });

  it('retorna 400 se peso estiver ausente', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({ altura: 1.70, idade: 30, sexo: 'masculino', nivelAtividade: 1.55, objetivo: 'manutencao' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('retorna 400 se altura estiver ausente', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({ peso: 70, idade: 30, sexo: 'masculino', nivelAtividade: 1.55, objetivo: 'manutencao' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se idade estiver ausente', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({ peso: 70, altura: 1.70, sexo: 'masculino', nivelAtividade: 1.55, objetivo: 'manutencao' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se sexo estiver ausente', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({ peso: 70, altura: 1.70, idade: 30, nivelAtividade: 1.55, objetivo: 'manutencao' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se nivelAtividade estiver ausente', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({ peso: 70, altura: 1.70, idade: 30, sexo: 'masculino', objetivo: 'manutencao' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se objetivo estiver ausente', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({ peso: 70, altura: 1.70, idade: 30, sexo: 'masculino', nivelAtividade: 1.55 }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se ajusteObjetivoValor for negativo', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({
        peso: 70,
        altura: 1.70,
        idade: 30,
        sexo: 'masculino',
        nivelAtividade: 1.55,
        objetivo: 'emagrecimento',
        ajusteObjetivoValor: -200,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se formulaOverride for schofield e idade < 19', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({
        peso: 50, altura: 1.60, idade: 15, sexo: 'masculino',
        nivelAtividade: 1.55, objetivo: 'manutencao', formulaOverride: 'schofield',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 se formulaOverride for eer e idade < 19', async () => {
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(),
    });

    await calculate(
      makeReq({
        peso: 50, altura: 1.60, idade: 15, sexo: 'masculino',
        nivelAtividade: 1.55, objetivo: 'manutencao', formulaOverride: 'eer',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('chama nutritionService.calculateNutrition com o body completo', async () => {
    const mockResult = { imc: 24.2, tmb: 1618 };
    const nutritionService = makeNutritionService(mockResult);
    const { calculate } = createNutritionController({ nutritionService });

    const body = {
      peso: 70,
      altura: 1.70,
      idade: 30,
      sexo: 'masculino',
      nivelAtividade: 1.55,
      objetivo: 'manutencao',
    };

    await calculate(makeReq(body), res);

    expect(nutritionService.calculateNutrition).toHaveBeenCalledWith(body);
  });

  it('retorna 200 com o resultado do serviço em requisição válida', async () => {
    const mockResult = { imc: 24.2, tmb: 1618, getAjustado: 2508, alertas: [] };
    const { calculate } = createNutritionController({
      nutritionService: makeNutritionService(mockResult),
    });

    await calculate(
      makeReq({
        peso: 70,
        altura: 1.70,
        idade: 30,
        sexo: 'masculino',
        nivelAtividade: 1.55,
        objetivo: 'manutencao',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  it('retorna 500 quando o serviço lança um erro inesperado', async () => {
    const nutritionService = {
      calculateNutrition: vi.fn().mockImplementation(() => {
        throw new Error('Erro interno simulado');
      }),
    };

    const { calculate } = createNutritionController({ nutritionService });

    await calculate(
      makeReq({
        peso: 70,
        altura: 1.70,
        idade: 30,
        sexo: 'masculino',
        nivelAtividade: 1.55,
        objetivo: 'manutencao',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Erro interno simulado' }));
  });

  it('não chama nutritionService quando campos obrigatórios estão faltando', async () => {
    const nutritionService = makeNutritionService();
    const { calculate } = createNutritionController({ nutritionService });

    await calculate(makeReq({}), res);

    expect(nutritionService.calculateNutrition).not.toHaveBeenCalled();
  });
});
