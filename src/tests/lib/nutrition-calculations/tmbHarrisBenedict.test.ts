import { describe, it, expect } from 'vitest';
import { calcularHarrisBenedict } from '../../../lib/nutrition-calculations/tmbHarrisBenedict.ts';

describe('calcularHarrisBenedict', () => {
  it('calcula TMB masculino', () => {
    // 88.362 + (13.397*70) + (4.799*170) - (5.677*30) = 88.362+937.79+815.83-170.31 = 1671.672
    expect(calcularHarrisBenedict(70, 170, 30, 'masculino')).toBeCloseTo(1671.67, 1);
  });
  it('calcula TMB feminino', () => {
    // 447.593 + (9.247*60) + (3.098*165) - (4.330*25) = 447.593+554.82+511.17-108.25 = 1405.333
    expect(calcularHarrisBenedict(60, 165, 25, 'feminino')).toBeCloseTo(1405.33, 1);
  });
});
