import { describe, it, expect } from 'vitest';
import { calcularSchofield } from '../../../lib/nutrition-calculations/tmbSchofield.ts';
import { calcularOms } from '../../../lib/nutrition-calculations/tmbOms.ts';

describe('calcularSchofield — ramo pediátrico (idade <= 18)', () => {
  it('delega para a equação peso-only corrigida (idêntica a calcularOms)', () => {
    const resultado = calcularSchofield(22, 1.20, 7, 'masculino');
    expect(resultado.tmb).toBeCloseTo(calcularOms(22, 7, 'masculino'), 6);
  });

  it('ignora a altura (variante peso+altura não verificada — usa peso-only)', () => {
    const comAlturaBaixa = calcularSchofield(50, 1.40, 15, 'feminino');
    const comAlturaAlta = calcularSchofield(50, 1.80, 15, 'feminino');
    expect(comAlturaBaixa.tmb).toBe(comAlturaAlta.tmb);
  });

  it('emite alerta explicando o fallback para peso-only', () => {
    const resultado = calcularSchofield(25, 1.30, 10, 'masculino');
    expect(resultado.alertas.some((a) => a.includes('peso-only'))).toBe(true);
  });
});

describe('calcularSchofield — ramo adulto (idade > 18, peso+altura)', () => {
  it('calcula TMB masculino 18-30 anos (coeficientes inalterados)', () => {
    // 15.296*70 - 27.008*1.70 + 717.017 = 1070.72 - 45.9136 + 717.017 = 1741.8234
    const resultado = calcularSchofield(70, 1.70, 25, 'masculino');
    expect(resultado.tmb).toBeCloseTo(1741.8234, 2);
  });

  it('calcula TMB feminino 31-60 anos (coeficientes inalterados)', () => {
    // 8.604*60 - 25.096*1.65 + 864.962 = 516.24 - 41.4084 + 864.962 = 1339.7936
    const resultado = calcularSchofield(60, 1.65, 40, 'feminino');
    expect(resultado.tmb).toBeCloseTo(1339.7936, 2);
  });

  it('calcula TMB masculino >60 anos (coeficientes inalterados)', () => {
    // 8.843*70 + 1128.107*1.70 - 1070.985 = 619.01 + 1917.7819 - 1070.985 = 1465.8069
    const resultado = calcularSchofield(70, 1.70, 65, 'masculino');
    expect(resultado.tmb).toBeCloseTo(1465.8069, 2);
  });

  it('emite alerta de coeficientes não verificados', () => {
    const resultado = calcularSchofield(70, 1.70, 25, 'masculino');
    expect(resultado.alertas.some((a) => a.includes('não puderam ser verificados'))).toBe(true);
  });
});
