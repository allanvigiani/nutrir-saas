import { describe, it, expect } from 'vitest';
import { calcularKcalKg } from '../../../lib/nutrition-calculations/tmbKcalKg.ts';

describe('calcularKcalKg', () => {
  it('usa 25 kcal/kg por padrão quando kcalKgValor não é informado', () => {
    const resultado = calcularKcalKg(70, undefined, 1.0);
    expect(resultado.tmb).toBe(1750);
    expect(resultado.get).toBe(1750);
  });
  it('usa o valor informado e aplica fatorClinicoBase apenas ao get', () => {
    const resultado = calcularKcalKg(70, 30, 1.2);
    expect(resultado.tmb).toBe(2100);
    expect(resultado.get).toBe(2520);
  });
});
