import { describe, it, expect } from 'vitest';
import { calcularPesoAjustado } from '../../../lib/nutrition-calculations/pesoAjustado.ts';

describe('calcularPesoAjustado', () => {
  it('usa peso atual quando IMC < 30', () => {
    const result = calcularPesoAjustado(70, 1.70, 24.2, 30);
    expect(result.pesoUtilizado).toBe(70);
    expect(result.justificativaPeso).toContain('Peso atual');
  });

  it('ajusta peso (IBW + 25% do excesso) quando IMC >= 30 em adulto', () => {
    // peso=100, altura=1.70 -> pesoIdeal = 22*1.70^2 = 63.58
    // ajustado = 63.58 + 0.25*(100-63.58) = 63.58 + 9.105 = 72.685
    const result = calcularPesoAjustado(100, 1.70, 34.6, 30);
    expect(result.pesoUtilizado).toBeCloseTo(72.685, 2);
    expect(result.justificativaPeso).toContain('Peso ajustado');
  });

  it('não ajusta peso em menores de 18 anos mesmo com IMC >= 30', () => {
    const result = calcularPesoAjustado(100, 1.60, 39.1, 15);
    expect(result.pesoUtilizado).toBe(100);
    expect(result.justificativaPeso).toContain('Peso atual');
  });
});
