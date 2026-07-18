import { calculateImc, classifyImc } from '../../lib/nutrition-calculations/imc.ts';
import { calcularPesoAjustado } from '../../lib/nutrition-calculations/pesoAjustado.ts';
import { classifyFaixaEtaria } from '../../lib/nutrition-calculations/faixaEtaria.ts';
import { sugerirFormula } from '../../lib/nutrition-calculations/selecaoFormula.ts';
import { calcularFatorClinico } from '../../lib/nutrition-calculations/fatorClinico.ts';
import { calcularMifflin } from '../../lib/nutrition-calculations/tmbMifflin.ts';
import { calcularHarrisBenedict } from '../../lib/nutrition-calculations/tmbHarrisBenedict.ts';
import { calcularOms } from '../../lib/nutrition-calculations/tmbOms.ts';
import { calcularSchofield } from '../../lib/nutrition-calculations/tmbSchofield.ts';
import { calcularEer } from '../../lib/nutrition-calculations/eerDri.ts';
import { calcularKcalKg } from '../../lib/nutrition-calculations/tmbKcalKg.ts';
import { calcularAjusteObjetivo, calcularBonusGestacao } from '../../lib/nutrition-calculations/ajusteObjetivoCalorico.ts';
import { calcularMacronutrientes } from '../../lib/nutrition-calculations/macronutrientes.ts';

export interface NutritionCalculationInput {
  peso: number;
  altura: number; // in meters
  sexo: 'masculino' | 'feminino';
  idade: number;
  nivelAtividade: number; // 1.2 | 1.375 | 1.55 | 1.725
  objetivo: 'emagrecimento' | 'manutencao' | 'hipertrofia' | 'reabilitacao';
  ajusteObjetivoValor?: number; // magnitude (>= 0); sinal é aplicado internamente conforme objetivo
  condicoesClinicas: string[];
  fatorClinicoValor?: number; // specific value chosen within range
  kcalKgValor?: number; // for kcal/kg formula (e.g. 25-30)
  formulaOverride?: 'mifflin' | 'harris' | 'oms' | 'kcal_kg' | 'schofield' | 'eer';
  categoriaAtividadeEER?: 'sedentario' | 'pouco_ativo' | 'ativo' | 'muito_ativo'; // usado apenas quando formulaOverride === 'eer'
  idadeMeses?: number; // 0-35; usado apenas por 'eer' para resolver a equação de lactente
  percentualLip?: number; // default 25
  percentualPtn?: number; // percentual override
  percentualCho?: number; // percentual override
  gKgPtn?: number; // kept for compatibility if needed
  trimestreGestacao?: 1 | 2 | 3;
}

export interface NutritionCalculationOutput {
  imc: number;
  classificacaoImc: string;
  faixaEtaria: string;
  pesoUtilizado: number;
  justificativaPeso: string;
  formulaSugerida: string;
  formulaUtilizada: string;
  tmb: number;
  get: number; // before objective adjustment
  getAjustado: number; // after objective adjustment and special conditions
  macronutrientes: {
    ptnKcal: number;
    ptnG: number;
    ptnGKg: number;
    ptnPercentual: number;
    choKcal: number;
    choG: number;
    choGKg: number;
    choPercentual: number;
    lipKcal: number;
    lipG: number;
    lipPercentual: number;
  };
  alertas: string[];
}

export function createNutritionService() {
  function calculateNutrition(input: NutritionCalculationInput): NutritionCalculationOutput {
    const {
      peso, altura, sexo, idade, nivelAtividade, objetivo,
      condicoesClinicas = [], formulaOverride, trimestreGestacao,
    } = input;

    const alertas: string[] = [];

    const imc = calculateImc(peso, altura);
    const classificacaoImc = classifyImc(imc);
    if (idade < 18) alertas.push('Paciente menor de 18 anos: avaliação por curva de crescimento recomendada para classificação precisa do IMC.');

    const faixaEtaria = classifyFaixaEtaria(idade);

    const { pesoUtilizado, justificativaPeso } = calcularPesoAjustado(peso, altura, imc, idade);

    const formulaSugerida = sugerirFormula(idade, condicoesClinicas);
    const formulaUtilizada = formulaOverride || formulaSugerida;

    const alturaCm = altura * 100;

    const isInflamado = condicoesClinicas.includes('inflamacao');
    const isDoencaCronica = condicoesClinicas.includes('doenca_cronica');
    const isInfeccao = condicoesClinicas.includes('infeccao');
    const isPosCirurgico = condicoesClinicas.includes('pos_cirurgico');

    const fatorClinicoBase = calcularFatorClinico({
      fatorClinicoValor: input.fatorClinicoValor,
      condicoesClinicas,
    });

    let tmb = 0;
    let get = 0;

    if (formulaUtilizada === 'mifflin') {
      tmb = calcularMifflin(pesoUtilizado, alturaCm, idade, sexo);
      get = tmb * nivelAtividade * fatorClinicoBase;
    } else if (formulaUtilizada === 'harris') {
      tmb = calcularHarrisBenedict(pesoUtilizado, alturaCm, idade, sexo);
      get = tmb * nivelAtividade * fatorClinicoBase;
    } else if (formulaUtilizada === 'oms') {
      tmb = calcularOms(pesoUtilizado, idade, sexo);
      get = tmb * nivelAtividade * fatorClinicoBase;
    } else if (formulaUtilizada === 'schofield') {
      const resultadoSchofield = calcularSchofield(pesoUtilizado, altura, idade, sexo);
      tmb = resultadoSchofield.tmb;
      alertas.push(...resultadoSchofield.alertas);
      get = tmb * nivelAtividade * fatorClinicoBase;
    } else if (formulaUtilizada === 'eer') {
      const resultadoEer = calcularEer({
        pesoKg: pesoUtilizado,
        alturaM: altura,
        idade,
        sexo,
        idadeMeses: input.idadeMeses,
        categoriaAtividadeEER: input.categoriaAtividadeEER,
        fatorClinicoBase,
      });
      tmb = resultadoEer.tmb;
      get = resultadoEer.get;
    } else if (formulaUtilizada === 'kcal_kg') {
      const resultadoKcalKg = calcularKcalKg(pesoUtilizado, input.kcalKgValor, fatorClinicoBase);
      tmb = resultadoKcalKg.tmb;
      get = resultadoKcalKg.get;
    }

    const { ajusteCalorico: ajusteCaloricoBase, alertas: alertasAjuste } = calcularAjusteObjetivo(
      objetivo, input.ajusteObjetivoValor, isInflamado, fatorClinicoBase,
    );
    alertas.push(...alertasAjuste);

    let getAjustado = get + ajusteCaloricoBase;

    if (condicoesClinicas.includes('gestante')) {
      const { bonus, alerta } = calcularBonusGestacao(trimestreGestacao);
      getAjustado += bonus;
      if (alerta) alertas.push(alerta);
    }

    if (isDoencaCronica || isInfeccao || isPosCirurgico) {
      alertas.push('Ajustar calorias e macronutrientes conforme demanda clínica.');
    }

    if (idade >= 60) {
      alertas.push('Idoso - Recomendação automática de proteína mínima de 1.2 g/kg aplicada.');
    }

    const macro = calcularMacronutrientes({
      getAjustado,
      pesoUtilizado,
      idade,
      objetivo,
      isDoencaCronica,
      isPosCirurgico,
      percentualPtn: input.percentualPtn,
      percentualLip: input.percentualLip,
      percentualCho: input.percentualCho,
      gKgPtn: input.gKgPtn,
    });
    alertas.push(...macro.alertas);

    return {
      imc: Math.round(imc * 10) / 10,
      classificacaoImc,
      faixaEtaria,
      pesoUtilizado: Math.round(pesoUtilizado * 10) / 10,
      justificativaPeso,
      formulaSugerida,
      formulaUtilizada,
      tmb: Math.round(tmb),
      get: Math.round(get),
      getAjustado: Math.round(getAjustado),
      macronutrientes: {
        ptnKcal: Math.round(macro.ptnKcal),
        ptnG: Math.round(macro.ptnG * 10) / 10,
        ptnGKg: Math.round(macro.ptnGKg * 100) / 100,
        ptnPercentual: Math.round(macro.ptnPercentual * 10) / 10,
        choKcal: Math.round(macro.choKcal),
        choG: Math.round(macro.choG * 10) / 10,
        choGKg: Math.round(macro.choGKg * 100) / 100,
        choPercentual: Math.round(macro.choPercentual * 10) / 10,
        lipKcal: Math.round(macro.lipKcal),
        lipG: Math.round(macro.lipG * 10) / 10,
        lipPercentual: Math.round(macro.lipPercentual * 10) / 10,
      },
      alertas,
    };
  }

  return {
    calculateNutrition
  };
}
