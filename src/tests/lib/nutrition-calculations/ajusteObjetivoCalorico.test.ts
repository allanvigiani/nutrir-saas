import { describe, it, expect } from 'vitest';
import { calcularAjusteObjetivo, calcularBonusGestacao } from '../../../lib/nutrition-calculations/ajusteObjetivoCalorico.ts';

describe('calcularAjusteObjetivo', () => {
  it('aplica default -400 para emagrecimento sem valor informado', () => {
    expect(calcularAjusteObjetivo('emagrecimento', undefined, false, 1.0).ajusteCalorico).toBe(-400);
  });
  it('aplica default +400 para hipertrofia sem valor informado', () => {
    expect(calcularAjusteObjetivo('hipertrofia', undefined, false, 1.0).ajusteCalorico).toBe(400);
  });
  it('aplica default +300 para reabilitação sem valor informado', () => {
    expect(calcularAjusteObjetivo('reabilitacao', undefined, false, 1.0).ajusteCalorico).toBe(300);
  });
  it('trata ajusteObjetivoValor como magnitude e aplica o sinal certo (regressão do bug histórico)', () => {
    // valor positivo + emagrecimento deve SUBTRAIR, nunca somar
    expect(calcularAjusteObjetivo('emagrecimento', 400, false, 1.0).ajusteCalorico).toBe(-400);
    expect(calcularAjusteObjetivo('hipertrofia', 400, false, 1.0).ajusteCalorico).toBe(400);
  });
  it('limita superávit a +300 kcal em paciente inflamado com objetivo hipertrofia', () => {
    const resultado = calcularAjusteObjetivo('hipertrofia', 500, true, 1.3);
    expect(resultado.ajusteCalorico).toBe(300);
    expect(resultado.alertas.some((a) => a.includes('Evitar superávit'))).toBe(true);
  });
});

describe('calcularBonusGestacao', () => {
  it('retorna +340 kcal para 2º trimestre', () => {
    expect(calcularBonusGestacao(2).bonus).toBe(340);
  });
  it('retorna +450 kcal para 3º trimestre', () => {
    expect(calcularBonusGestacao(3).bonus).toBe(450);
  });
  it('retorna 0 para 1º trimestre ou indefinido', () => {
    expect(calcularBonusGestacao(1).bonus).toBe(0);
    expect(calcularBonusGestacao(undefined).bonus).toBe(0);
  });
});
