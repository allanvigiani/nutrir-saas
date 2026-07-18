import { describe, it, expect } from 'vitest';
import { calculateImc, classifyImc, idealWeightRangeByBmi } from '../../../lib/nutrition-calculations/imc.ts';

describe('calculateImc', () => {
  it('calcula IMC a partir de peso (kg) e altura (m)', () => {
    expect(calculateImc(70, 1.70)).toBeCloseTo(24.221, 2);
  });
});

describe('classifyImc', () => {
  it('classifica Baixo peso (IMC < 18.5)', () => {
    expect(classifyImc(18.0)).toBe('Baixo peso');
  });
  it('classifica Eutrófico (18.5 <= IMC < 25)', () => {
    expect(classifyImc(22.0)).toBe('Eutrófico');
  });
  it('classifica Sobrepeso (25 <= IMC < 30)', () => {
    expect(classifyImc(27.0)).toBe('Sobrepeso');
  });
  it('classifica Obesidade grau I (30 <= IMC < 35)', () => {
    expect(classifyImc(32.0)).toBe('Obesidade grau I');
  });
  it('classifica Obesidade grau II (35 <= IMC < 40)', () => {
    expect(classifyImc(37.0)).toBe('Obesidade grau II');
  });
  it('classifica Obesidade grau III (IMC >= 40)', () => {
    expect(classifyImc(41.0)).toBe('Obesidade grau III (mórbida)');
  });
});

describe('idealWeightRangeByBmi', () => {
  it('calcula faixa de peso ideal (IMC 18.5-24.9) para uma altura', () => {
    // 18.5*1.80^2 = 18.5*3.24 = 59.94 -> 59.9 | 24.9*1.80^2 = 24.9*3.24 = 80.676 -> 80.7
    const { min, max } = idealWeightRangeByBmi(1.80);
    expect(min).toBeCloseTo(59.9, 1);
    expect(max).toBeCloseTo(80.7, 1);
  });
});
