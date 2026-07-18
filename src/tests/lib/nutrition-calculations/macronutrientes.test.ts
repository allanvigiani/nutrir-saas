import { describe, it, expect } from 'vitest';
import { calcularMacronutrientes } from '../../../lib/nutrition-calculations/macronutrientes.ts';

function baseInput(overrides = {}) {
  return {
    getAjustado: 2000,
    pesoUtilizado: 70,
    idade: 30,
    objetivo: 'manutencao' as const,
    isDoencaCronica: false,
    isPosCirurgico: false,
    ...overrides,
  };
}

describe('calcularMacronutrientes', () => {
  it('usa 1.4 g/kg de proteína por padrão em manutenção', () => {
    // ptnKcal = 1.4*70*4 = 392; percentual = 392/2000*100 = 19.6
    const resultado = calcularMacronutrientes(baseInput());
    expect(resultado.ptnGKg).toBeCloseTo(1.4, 2);
    expect(resultado.ptnPercentual).toBeCloseTo(19.6, 1);
  });
  it('usa 1.8 g/kg para emagrecimento e 2.0 g/kg para hipertrofia', () => {
    expect(calcularMacronutrientes(baseInput({ objetivo: 'emagrecimento' })).ptnGKg).toBeCloseTo(1.8, 2);
    expect(calcularMacronutrientes(baseInput({ objetivo: 'hipertrofia' })).ptnGKg).toBeCloseTo(2.0, 2);
  });
  it('aplica piso de 1.2 g/kg para idosos', () => {
    expect(calcularMacronutrientes(baseInput({ idade: 65 })).ptnGKg).toBeCloseTo(1.2, 2);
  });
  it('usa 25% de lipídio por padrão', () => {
    expect(calcularMacronutrientes(baseInput()).lipPercentual).toBeCloseTo(25, 1);
  });
  it('emite alerta quando carboidrato fica abaixo de 100g/dia', () => {
    const resultado = calcularMacronutrientes(baseInput({
      getAjustado: 1200, percentualPtn: 60, percentualLip: 35, percentualCho: 5,
    }));
    expect(resultado.alertas.some((a) => a.includes('Carboidratos'))).toBe(true);
  });
});
