import { describe, it, expect } from 'vitest';
import { calcularOms } from '../../../lib/nutrition-calculations/tmbOms.ts';

// Valores de referência: FAO, Human energy requirements (2004), Table 5.2,
// coluna "BMR: kcal/day" — https://www.fao.org/4/y5686e/y5686e07.htm
// (fonte primária citada: "Source: Schofield, 1985").
describe('calcularOms — masculino', () => {
  it('faixa <=3 anos: 59.512*peso - 30.4', () => {
    expect(calcularOms(12, 2, 'masculino')).toBeCloseTo((59.512 * 12) - 30.4, 3);
  });
  it('faixa <=10 anos: 22.706*peso + 504.3', () => {
    expect(calcularOms(22, 7, 'masculino')).toBeCloseTo((22.706 * 22) + 504.3, 3);
  });
  it('faixa <=18 anos: 17.686*peso + 658.2', () => {
    expect(calcularOms(55, 15, 'masculino')).toBeCloseTo((17.686 * 55) + 658.2, 3);
  });
  it('faixa <=30 anos: 15.057*peso + 692.2', () => {
    expect(calcularOms(70, 25, 'masculino')).toBeCloseTo((15.057 * 70) + 692.2, 3);
  });
  it('faixa <=60 anos: 11.472*peso + 873.1', () => {
    expect(calcularOms(80, 45, 'masculino')).toBeCloseTo((11.472 * 80) + 873.1, 3);
  });
  it('faixa >60 anos: 11.711*peso + 587.7', () => {
    expect(calcularOms(70, 65, 'masculino')).toBeCloseTo((11.711 * 70) + 587.7, 3);
  });
});

describe('calcularOms — feminino', () => {
  it('faixa <=3 anos: 58.317*peso - 31.1', () => {
    expect(calcularOms(11, 2, 'feminino')).toBeCloseTo((58.317 * 11) - 31.1, 3);
  });
  it('faixa <=10 anos: 20.315*peso + 485.9', () => {
    expect(calcularOms(21, 7, 'feminino')).toBeCloseTo((20.315 * 21) + 485.9, 3);
  });
  it('faixa <=18 anos: 13.384*peso + 692.6', () => {
    expect(calcularOms(50, 15, 'feminino')).toBeCloseTo((13.384 * 50) + 692.6, 3);
  });
  it('faixa <=30 anos: 14.818*peso + 486.6', () => {
    expect(calcularOms(60, 25, 'feminino')).toBeCloseTo((14.818 * 60) + 486.6, 3);
  });
  it('faixa <=60 anos: 8.126*peso + 845.6', () => {
    expect(calcularOms(65, 45, 'feminino')).toBeCloseTo((8.126 * 65) + 845.6, 3);
  });
  it('faixa >60 anos: 9.082*peso + 658.5', () => {
    expect(calcularOms(60, 65, 'feminino')).toBeCloseTo((9.082 * 60) + 658.5, 3);
  });
});
