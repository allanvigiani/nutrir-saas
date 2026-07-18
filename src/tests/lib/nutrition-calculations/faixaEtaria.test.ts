import { describe, it, expect } from 'vitest';
import { classifyFaixaEtaria } from '../../../lib/nutrition-calculations/faixaEtaria.ts';

describe('classifyFaixaEtaria', () => {
  it('retorna Criança/Adolescente para idade < 18', () => {
    expect(classifyFaixaEtaria(12)).toBe('Criança/Adolescente');
  });
  it('retorna Adulto para 18 <= idade <= 59', () => {
    expect(classifyFaixaEtaria(40)).toBe('Adulto');
    expect(classifyFaixaEtaria(59)).toBe('Adulto');
  });
  it('retorna Idoso para idade >= 60', () => {
    expect(classifyFaixaEtaria(60)).toBe('Idoso');
  });
});
