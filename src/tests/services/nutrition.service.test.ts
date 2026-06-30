import { describe, it, expect } from 'vitest';
import {
  createNutritionService,
  NutritionCalculationInput,
} from '../../server/services/nutrition.service.ts';

const { calculateNutrition } = createNutritionService();

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<NutritionCalculationInput> = {}): NutritionCalculationInput {
  return {
    peso: 70,
    altura: 1.70,
    sexo: 'masculino',
    idade: 30,
    nivelAtividade: 1.55,      // moderadamente ativo
    objetivo: 'manutencao',
    condicoesClinicas: [],
    ...overrides,
  };
}

// ─── IMC e Classificação ────────────────────────────────────────────────────

describe('IMC e Classificação', () => {
  it('calcula IMC corretamente', () => {
    const result = calculateNutrition(baseInput({ peso: 70, altura: 1.70 }));
    expect(result.imc).toBeCloseTo(24.2, 0);
  });

  it('classifica Baixo peso (IMC < 18.5)', () => {
    const result = calculateNutrition(baseInput({ peso: 50, altura: 1.70 }));
    expect(result.classificacaoImc).toBe('Baixo peso');
  });

  it('classifica Eutrófico (18.5 ≤ IMC < 25)', () => {
    const result = calculateNutrition(baseInput({ peso: 70, altura: 1.70 }));
    expect(result.classificacaoImc).toBe('Eutrófico');
  });

  it('classifica Sobrepeso (25 ≤ IMC < 30)', () => {
    const result = calculateNutrition(baseInput({ peso: 85, altura: 1.70 }));
    expect(result.classificacaoImc).toBe('Sobrepeso');
  });

  it('classifica Obesidade grau I (30 ≤ IMC < 35)', () => {
    const result = calculateNutrition(baseInput({ peso: 97, altura: 1.70 }));
    expect(result.classificacaoImc).toBe('Obesidade grau I');
  });

  it('classifica Obesidade grau II (35 ≤ IMC < 40)', () => {
    const result = calculateNutrition(baseInput({ peso: 115, altura: 1.80 }));
    expect(result.classificacaoImc).toBe('Obesidade grau II');
  });

  it('classifica Obesidade grau III (IMC ≥ 40)', () => {
    const result = calculateNutrition(baseInput({ peso: 140, altura: 1.70 }));
    expect(result.classificacaoImc).toBe('Obesidade grau III (mórbida)');
  });

  it('retorna avaliação por curva de crescimento para menores de 18 anos', () => {
    const result = calculateNutrition(baseInput({ idade: 15 }));
    expect(result.classificacaoImc).toBe('Eutrófico');
  });
});

// ─── Faixa Etária ───────────────────────────────────────────────────────────

describe('Faixa Etária', () => {
  it('retorna Criança/Adolescente para idade < 18', () => {
    expect(calculateNutrition(baseInput({ idade: 12 })).faixaEtaria).toBe('Criança/Adolescente');
  });

  it('retorna Adulto para 18 ≤ idade ≤ 59', () => {
    expect(calculateNutrition(baseInput({ idade: 40 })).faixaEtaria).toBe('Adulto');
  });

  it('retorna Idoso para idade ≥ 60', () => {
    expect(calculateNutrition(baseInput({ idade: 65 })).faixaEtaria).toBe('Idoso');
  });
});

// ─── Peso Ajustado ──────────────────────────────────────────────────────────

describe('Peso Ajustado (IMC ≥ 30)', () => {
  it('usa peso atual quando IMC < 30', () => {
    const result = calculateNutrition(baseInput({ peso: 70, altura: 1.70 }));
    expect(result.pesoUtilizado).toBe(70);
    expect(result.justificativaPeso).toContain('Peso atual');
  });

  it('usa peso ajustado quando IMC ≥ 30 em adulto', () => {
    // peso=100, altura=1.70 → IMC≈34.6
    const result = calculateNutrition(baseInput({ peso: 100, altura: 1.70 }));
    const pesoIdeal = 22 * (1.70 * 1.70); // ≈ 63.58
    const esperado = Math.round((pesoIdeal + 0.25 * (100 - pesoIdeal)) * 10) / 10;
    expect(result.pesoUtilizado).toBe(esperado);
    expect(result.justificativaPeso).toContain('Peso ajustado');
  });

  it('não ajusta peso em menores de 18 com IMC ≥ 30', () => {
    const result = calculateNutrition(baseInput({ idade: 15, peso: 100, altura: 1.60 }));
    expect(result.pesoUtilizado).toBe(100);
  });
});

// ─── Fórmula Sugerida ───────────────────────────────────────────────────────

describe('Seleção de Fórmula', () => {
  it('sugere Mifflin para adultos saudáveis', () => {
    const result = calculateNutrition(baseInput());
    expect(result.formulaSugerida).toBe('mifflin');
  });

  it('sugere OMS para crianças/adolescentes (idade < 18)', () => {
    const result = calculateNutrition(baseInput({ idade: 15 }));
    expect(result.formulaSugerida).toBe('oms');
  });

  it('sugere OMS para idosos (idade ≥ 60)', () => {
    const result = calculateNutrition(baseInput({ idade: 65 }));
    expect(result.formulaSugerida).toBe('oms');
  });

  it('sugere kcal_kg para pacientes hospitalizados', () => {
    const result = calculateNutrition(baseInput({ condicoesClinicas: ['internado'] }));
    expect(result.formulaSugerida).toBe('kcal_kg');
  });

  it('respeita formulaOverride mesmo quando sugeriria outra', () => {
    const result = calculateNutrition(baseInput({ formulaOverride: 'harris' }));
    expect(result.formulaUtilizada).toBe('harris');
  });
});

// ─── Cálculo de TMB por fórmula ─────────────────────────────────────────────

describe('TMB — Fórmula Mifflin-St Jeor', () => {
  it('calcula TMB masculino corretamente', () => {
    // TMB = (10*70) + (6.25*170) - (5*30) + 5 = 700+1062.5-150+5 = 1617.5
    const result = calculateNutrition(baseInput());
    expect(result.tmb).toBe(1618);
  });

  it('calcula TMB feminino corretamente', () => {
    // TMB = (10*60) + (6.25*165) - (5*25) - 161 = 600+1031.25-125-161 = 1345.25
    const result = calculateNutrition(baseInput({ sexo: 'feminino', peso: 60, altura: 1.65, idade: 25 }));
    expect(result.tmb).toBe(1345);
  });
});

describe('TMB — Fórmula Harris-Benedict', () => {
  it('calcula TMB masculino via Harris', () => {
    // 88.36 + (13.4*70) + (4.8*170) - (5.68*30) = 88.36+938+816-170.4 = 1671.96
    const result = calculateNutrition(baseInput({ formulaOverride: 'harris' }));
    expect(result.tmb).toBe(1672);
  });

  it('calcula TMB feminino via Harris', () => {
    // 447.593 + (9.247*60) + (3.098*165) - (4.330*25) = 447.593+554.82+511.17-108.25 = 1405.333
    const result = calculateNutrition(baseInput({ sexo: 'feminino', peso: 60, altura: 1.65, idade: 25, formulaOverride: 'harris' }));
    expect(result.tmb).toBe(1405);
  });
});

describe('TMB — Fórmula OMS', () => {
  it('calcula TMB masculino adulto (18-30 anos) via OMS', () => {
    // (15.3 * 70) + 679 = 1071 + 679 = 1750
    const result = calculateNutrition(baseInput({ formulaOverride: 'oms', idade: 25 }));
    expect(result.tmb).toBe(1750);
  });

  it('calcula TMB feminino adulta (31-60 anos) via OMS', () => {
    // (8.7 * 60) + 829 = 522 + 829 = 1351
    const result = calculateNutrition(baseInput({ sexo: 'feminino', peso: 60, altura: 1.65, idade: 40, formulaOverride: 'oms' }));
    expect(result.tmb).toBe(1351);
  });

  it('calcula TMB masculino idoso (> 60 anos) via OMS', () => {
    // (13.5 * 70) + 487 = 945 + 487 = 1432
    const result = calculateNutrition(baseInput({ idade: 65, formulaOverride: 'oms' }));
    expect(result.tmb).toBe(1432);
  });
});

describe('TMB — Fórmula Schofield (peso + altura)', () => {
  it('calcula TMB masculino adulto (18-30 anos) via Schofield', () => {
    // 15.296*70 - 27.008*1.70 + 717.017 = 1070.72 - 45.9136 + 717.017 = 1741.8234
    const result = calculateNutrition(baseInput({ formulaOverride: 'schofield', idade: 25 }));
    expect(result.tmb).toBe(1742);
  });

  it('calcula TMB feminino adulta (31-60 anos) via Schofield', () => {
    // 8.604*60 - 25.096*1.65 + 864.962 = 516.24 - 41.4084 + 864.962 = 1339.7936
    const result = calculateNutrition(baseInput({ sexo: 'feminino', peso: 60, altura: 1.65, idade: 40, formulaOverride: 'schofield' }));
    expect(result.tmb).toBe(1340);
  });

  it('calcula TMB masculino idoso (> 60 anos) via Schofield', () => {
    // 8.843*70 + 1128.107*1.70 - 1070.985 = 619.01 + 1917.7819 - 1070.985 = 1465.8069
    const result = calculateNutrition(baseInput({ idade: 65, formulaOverride: 'schofield' }));
    expect(result.tmb).toBe(1466);
  });
});

describe('GET — kcal_kg', () => {
  it('usa kcalKgValor se fornecido', () => {
    const result = calculateNutrition(baseInput({ formulaOverride: 'kcal_kg', kcalKgValor: 30 }));
    // tmb = 30 * 70 = 2100 (sem fator atividade, fatorClinico=1)
    expect(result.tmb).toBe(2100);
    expect(result.get).toBe(2100);
  });

  it('usa default 25 kcal/kg se kcalKgValor não for informado', () => {
    const result = calculateNutrition(baseInput({ formulaOverride: 'kcal_kg' }));
    expect(result.tmb).toBe(25 * 70); // 1750
  });
});

// ─── GET e Ajuste de Objetivo ───────────────────────────────────────────────

describe('GET e Ajuste de Objetivo', () => {
  it('aplica -400 kcal para emagrecimento (sem override)', () => {
    const base = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    const emag = calculateNutrition(baseInput({ objetivo: 'emagrecimento' }));
    expect(emag.getAjustado).toBe(base.get - 400);
  });

  it('aplica +400 kcal para hipertrofia (sem override)', () => {
    const base = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    const hiper = calculateNutrition(baseInput({ objetivo: 'hipertrofia' }));
    expect(hiper.getAjustado).toBe(base.get + 400);
  });

  it('aplica +300 kcal para reabilitação (sem override)', () => {
    const base = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    const reab = calculateNutrition(baseInput({ objetivo: 'reabilitacao' }));
    expect(reab.getAjustado).toBe(base.get + 300);
  });

  it('respeita ajusteObjetivoValor quando fornecido', () => {
    const base = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    const custom = calculateNutrition(baseInput({ objetivo: 'emagrecimento', ajusteObjetivoValor: -200 }));
    expect(custom.getAjustado).toBe(base.get - 200);
  });

  it('manutenção não altera GET', () => {
    const result = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    expect(result.getAjustado).toBe(result.get);
  });

  it('aplica desconto corretamente mesmo quando ajusteObjetivoValor é informado positivo para emagrecimento (regressão de bug)', () => {
    const base = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    const result = calculateNutrition(baseInput({ objetivo: 'emagrecimento', ajusteObjetivoValor: 400 }));
    expect(result.getAjustado).toBe(base.get - 400);
  });

  it('aplica acréscimo corretamente mesmo quando ajusteObjetivoValor é informado negativo para hipertrofia (regressão de bug)', () => {
    const base = calculateNutrition(baseInput({ objetivo: 'manutencao' }));
    const result = calculateNutrition(baseInput({ objetivo: 'hipertrofia', ajusteObjetivoValor: -400 }));
    expect(result.getAjustado).toBe(base.get + 400);
  });
});

// ─── Fator Clínico ──────────────────────────────────────────────────────────

describe('Fator Clínico', () => {
  it('aplica FC=1.5 para sepse/critico', () => {
    const base = calculateNutrition(baseInput({ formulaOverride: 'mifflin' }));
    const critic = calculateNutrition(baseInput({ formulaOverride: 'mifflin', condicoesClinicas: ['critico'] }));
    // GET com FC=1.5 deve ser maior que GET com FC=1.0
    expect(critic.get).toBeGreaterThan(base.get);
    // A razão entre os GETs deve ser próxima de 1.5 (FC)
    expect(critic.get / base.get).toBeCloseTo(1.5, 1);
  });

  it('respeita fatorClinicoValor quando fornecido', () => {
    const base = calculateNutrition(baseInput({ formulaOverride: 'mifflin' }));
    const custom = calculateNutrition(baseInput({ formulaOverride: 'mifflin', fatorClinicoValor: 1.3 }));
    // GET com FC=1.3 deve ser maior que GET com FC=1.0
    expect(custom.get).toBeGreaterThan(base.get);
    // A razão entre os GETs deve ser próxima de 1.3 (FC)
    expect(custom.get / base.get).toBeCloseTo(1.3, 1);
  });
});

// ─── Gestante ───────────────────────────────────────────────────────────────

describe('Gestante', () => {
  it('adiciona +340 kcal no 2º trimestre', () => {
    const base = calculateNutrition(baseInput({ sexo: 'feminino', objetivo: 'manutencao' }));
    const gest2 = calculateNutrition(baseInput({ sexo: 'feminino', objetivo: 'manutencao', condicoesClinicas: ['gestante'], trimestreGestacao: 2 }));
    expect(gest2.getAjustado).toBe(base.getAjustado + 340);
    expect(gest2.alertas).toContain('Gestante (2º Tri) — calorias adicionais aplicadas (+340 kcal)');
  });

  it('adiciona +450 kcal no 3º trimestre', () => {
    const base = calculateNutrition(baseInput({ sexo: 'feminino', objetivo: 'manutencao' }));
    const gest3 = calculateNutrition(baseInput({ sexo: 'feminino', objetivo: 'manutencao', condicoesClinicas: ['gestante'], trimestreGestacao: 3 }));
    expect(gest3.getAjustado).toBe(base.getAjustado + 450);
    expect(gest3.alertas).toContain('Gestante (3º Tri) — calorias adicionais aplicadas (+450 kcal)');
  });

  it('não adiciona calorias extras no 1º trimestre', () => {
    const base = calculateNutrition(baseInput({ sexo: 'feminino', objetivo: 'manutencao' }));
    const gest1 = calculateNutrition(baseInput({ sexo: 'feminino', objetivo: 'manutencao', condicoesClinicas: ['gestante'], trimestreGestacao: 1 }));
    expect(gest1.getAjustado).toBe(base.getAjustado);
  });
});

// ─── Alertas ────────────────────────────────────────────────────────────────

describe('Alertas', () => {
  it('emite alerta para paciente idoso (proteína mínima)', () => {
    const result = calculateNutrition(baseInput({ idade: 65 }));
    expect(result.alertas.some(a => a.includes('Idoso'))).toBe(true);
  });

  it('emite alerta quando CHO < 100g/dia', () => {
    // Forçar CHO baixo: alto percentual PTN e LIP
    const result = calculateNutrition(baseInput({
      getAjustado: 1200,
      percentualPtn: 60,
      percentualLip: 35,
      percentualCho: 5,
    } as any));
    expect(result.alertas.some(a => a.includes('Carboidratos'))).toBe(true);
  });

  it('limita superávit a +300 kcal em paciente inflamado com objetivo hipertrofia', () => {
    const result = calculateNutrition(baseInput({
      objetivo: 'hipertrofia',
      condicoesClinicas: ['inflamacao'],
      fatorClinicoValor: 1.3,
      ajusteObjetivoValor: 500, // tentando +500
    }));
    expect(result.alertas.some(a => a.includes('Evitar superávit calórico elevado'))).toBe(true);
    // getAjustado deve ser get+300, não get+500
    expect(result.getAjustado).toBe(result.get + 300);
  });
});

// ─── Macronutrientes ─────────────────────────────────────────────────────────

describe('Macronutrientes', () => {
  it('percentuais somam ~100% quando auto-calculados', () => {
    const result = calculateNutrition(baseInput());
    const total = result.macronutrientes.ptnPercentual + result.macronutrientes.choPercentual + result.macronutrientes.lipPercentual;
    expect(total).toBeCloseTo(100, 0);
  });

  it('respeita percentualLip quando fornecido', () => {
    const result = calculateNutrition(baseInput({ percentualLip: 30 }));
    expect(result.macronutrientes.lipPercentual).toBeCloseTo(30, 0);
  });

  it('respeita percentualPtn quando fornecido', () => {
    const result = calculateNutrition(baseInput({ percentualPtn: 30, percentualCho: 45, percentualLip: 25 }));
    expect(result.macronutrientes.ptnPercentual).toBeCloseTo(30, 0);
  });

  it('ptnG é calculado corretamente (kcal/4)', () => {
    const result = calculateNutrition(baseInput());
    expect(result.macronutrientes.ptnG).toBeCloseTo(result.macronutrientes.ptnKcal / 4, 0);
  });

  it('choG é calculado corretamente (kcal/4)', () => {
    const result = calculateNutrition(baseInput());
    expect(result.macronutrientes.choG).toBeCloseTo(result.macronutrientes.choKcal / 4, 0);
  });

  it('lipG é calculado corretamente (kcal/9)', () => {
    const result = calculateNutrition(baseInput());
    expect(result.macronutrientes.lipG).toBeCloseTo(result.macronutrientes.lipKcal / 9, 0);
  });

  it('emite alerta se soma dos percentuais ≠ 100 com override manual', () => {
    const result = calculateNutrition(baseInput({
      percentualPtn: 40,
      percentualCho: 40,
      percentualLip: 30, // soma = 110
    }));
    expect(result.alertas.some(a => a.includes('soma dos macronutrientes'))).toBe(true);
  });

  it('define proteína mínima 1.2g/kg para idosos', () => {
    const result = calculateNutrition(baseInput({ idade: 65, objetivo: 'manutencao' }));
    expect(result.macronutrientes.ptnGKg).toBeGreaterThanOrEqual(1.2);
  });

  it('define proteína padrão ≥ 1.8g/kg para emagrecimento', () => {
    const result = calculateNutrition(baseInput({ objetivo: 'emagrecimento' }));
    expect(result.macronutrientes.ptnGKg).toBeGreaterThanOrEqual(1.8);
  });

  it('define proteína padrão ≥ 2.0g/kg para hipertrofia', () => {
    const result = calculateNutrition(baseInput({ objetivo: 'hipertrofia' }));
    expect(result.macronutrientes.ptnGKg).toBeGreaterThanOrEqual(2.0);
  });
});

// ─── Valores retornados ──────────────────────────────────────────────────────

describe('Formato dos valores retornados', () => {
  it('retorna imc com 1 casa decimal', () => {
    const result = calculateNutrition(baseInput());
    expect(result.imc).toBe(Math.round(result.imc * 10) / 10);
  });

  it('retorna tmb como inteiro', () => {
    const result = calculateNutrition(baseInput());
    expect(Number.isInteger(result.tmb)).toBe(true);
  });

  it('retorna getAjustado como inteiro', () => {
    const result = calculateNutrition(baseInput());
    expect(Number.isInteger(result.getAjustado)).toBe(true);
  });

  it('retorna alertas como array (mesmo quando vazio)', () => {
    const result = calculateNutrition(baseInput());
    expect(Array.isArray(result.alertas)).toBe(true);
  });
});
