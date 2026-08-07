import { describe, it, expect } from 'vitest';
import { calcularFatorClinico } from '../../../lib/nutrition-calculations/fatorClinico.ts';

describe('calcularFatorClinico', () => {
  it('retorna 1.0 sem condições clínicas', () => {
    expect(calcularFatorClinico({ condicoesClinicas: [] })).toBe(1.0);
  });
  it('retorna 1.5 para sepse/crítico', () => {
    expect(calcularFatorClinico({ condicoesClinicas: ['sepse'] })).toBe(1.5);
    expect(calcularFatorClinico({ condicoesClinicas: ['critico'] })).toBe(1.5);
  });
  it('retorna 1.3 para trauma', () => {
    expect(calcularFatorClinico({ condicoesClinicas: ['trauma'] })).toBe(1.3);
  });
  it('retorna 1.2 para pós-cirúrgico, infecção ou doença crônica', () => {
    expect(calcularFatorClinico({ condicoesClinicas: ['pos_cirurgico'] })).toBe(1.2);
    expect(calcularFatorClinico({ condicoesClinicas: ['infeccao'] })).toBe(1.2);
    expect(calcularFatorClinico({ condicoesClinicas: ['doenca_cronica'] })).toBe(1.2);
  });
  it('retorna 1.1 para inflamação', () => {
    expect(calcularFatorClinico({ condicoesClinicas: ['inflamacao'] })).toBe(1.1);
  });
  it('prioriza sepse/crítico sobre as demais condições', () => {
    expect(calcularFatorClinico({ condicoesClinicas: ['inflamacao', 'sepse'] })).toBe(1.5);
  });
  it('usa fatorClinicoValor explícito quando fornecido, ignorando condições', () => {
    expect(calcularFatorClinico({ condicoesClinicas: ['sepse'], fatorClinicoValor: 1.35 })).toBe(1.35);
  });
});
