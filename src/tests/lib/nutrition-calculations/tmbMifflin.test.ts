import { describe, it, expect } from 'vitest';
import { calcularMifflin } from '../../../lib/nutrition-calculations/tmbMifflin.ts';

describe('calcularMifflin', () => {
  it('calcula TMB masculino', () => {
    // (10*70) + (6.25*170) - (5*30) + 5 = 700+1062.5-150+5 = 1617.5
    expect(calcularMifflin(70, 170, 30, 'masculino')).toBeCloseTo(1617.5, 1);
  });
  it('calcula TMB feminino', () => {
    // (10*60) + (6.25*165) - (5*25) - 161 = 600+1031.25-125-161 = 1345.25
    expect(calcularMifflin(60, 165, 25, 'feminino')).toBeCloseTo(1345.25, 1);
  });
});
