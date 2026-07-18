import { describe, it, expect } from 'vitest';
import { calcularEer } from '../../../lib/nutrition-calculations/eerDri.ts';

describe('calcularEer — lactente (idadeMeses 0-35)', () => {
  it('aplica offset +175 para 0-3 meses, sem fator de atividade', () => {
    // tmb = 89*8 - 100 + 175 = 712-100+175 = 787
    const resultado = calcularEer({
      pesoKg: 8, alturaM: 0.65, idade: 0, sexo: 'masculino', idadeMeses: 2, fatorClinicoBase: 1.0,
    });
    expect(resultado.tmb).toBeCloseTo(787, 3);
    expect(resultado.get).toBeCloseTo(787, 3);
  });

  it('aplica offset +20 para 13-35 meses', () => {
    // tmb = 89*11 - 100 + 20 = 979-100+20 = 899
    const resultado = calcularEer({
      pesoKg: 11, alturaM: 0.80, idade: 1, sexo: 'feminino', idadeMeses: 20, fatorClinicoBase: 1.0,
    });
    expect(resultado.tmb).toBeCloseTo(899, 3);
  });
});

describe('calcularEer — criança/adolescente (3-18 anos)', () => {
  it('calcula TMB (PAF=1.00 baseline) e GET (PAF real) masculino', () => {
    // base = 88.5 - 61.9*10 = 88.5-619 = -530.5
    // incremento = 26.7*32 + 903*1.35 = 854.4+1219.05 = 2073.45
    // tmb = base+incremento+20 = -530.5+2073.45+20 = 1562.95
    // get (PAF ativo=1.26) = (base + 1.26*incremento + 20) = -530.5+2612.547+20 = 2102.047
    const resultado = calcularEer({
      pesoKg: 32, alturaM: 1.35, idade: 10, sexo: 'masculino', categoriaAtividadeEER: 'ativo', fatorClinicoBase: 1.0,
    });
    expect(resultado.tmb).toBeCloseTo(1562.95, 1);
    expect(resultado.get).toBeCloseTo(2102.047, 1);
  });
});

describe('calcularEer — adulto (>= 19 anos)', () => {
  it('calcula TMB (PA=1.00 baseline) e GET (PA real) masculino', () => {
    // base = 662 - 9.53*30 = 662-285.9 = 376.1
    // incremento = 15.91*70 + 539.6*1.70 = 1113.7+917.32 = 2031.02
    // tmb = base+incremento = 2407.12
    // get (PA ativo=1.25) = base + 1.25*incremento = 376.1+2538.775 = 2914.875
    const resultado = calcularEer({
      pesoKg: 70, alturaM: 1.70, idade: 30, sexo: 'masculino', categoriaAtividadeEER: 'ativo', fatorClinicoBase: 1.0,
    });
    expect(resultado.tmb).toBeCloseTo(2407.12, 1);
    expect(resultado.get).toBeCloseTo(2914.875, 1);
  });

  it('aplica fatorClinicoBase somente ao GET, não ao TMB', () => {
    const resultado = calcularEer({
      pesoKg: 70, alturaM: 1.70, idade: 30, sexo: 'masculino', categoriaAtividadeEER: 'ativo', fatorClinicoBase: 1.5,
    });
    expect(resultado.tmb).toBeCloseTo(2407.12, 1);
    expect(resultado.get).toBeCloseTo(2914.875 * 1.5, 1);
  });
});

describe('calcularEer — sem equação disponível', () => {
  it('retorna tmb/get = 0 quando idade < 3 e idadeMeses ausente', () => {
    const resultado = calcularEer({ pesoKg: 12, alturaM: 0.9, idade: 1, sexo: 'masculino', fatorClinicoBase: 1.0 });
    expect(resultado.tmb).toBe(0);
    expect(resultado.get).toBe(0);
  });
});
