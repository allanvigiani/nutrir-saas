import type { Objetivo } from './ajusteObjetivoCalorico';

export interface MacronutrientesInput {
  getAjustado: number;
  pesoUtilizado: number;
  idade: number;
  objetivo: Objetivo;
  isDoencaCronica: boolean;
  isPosCirurgico: boolean;
  percentualPtn?: number;
  percentualLip?: number;
  percentualCho?: number;
  gKgPtn?: number;
}

export interface MacronutrientesResult {
  ptnKcal: number; ptnG: number; ptnGKg: number; ptnPercentual: number;
  choKcal: number; choG: number; choGKg: number; choPercentual: number;
  lipKcal: number; lipG: number; lipPercentual: number;
  alertas: string[];
}

// Defaults de g/kg de proteína e % de lipídio são valores de julgamento clínico —
// fora do escopo de correção desta auditoria (ver relatório, seção "não alterado").
export function calcularMacronutrientes(input: MacronutrientesInput): MacronutrientesResult {
  const { getAjustado, pesoUtilizado, idade, objetivo, isDoencaCronica, isPosCirurgico } = input;
  const alertas: string[] = [];

  let percentualPtn = input.percentualPtn;
  let percentualLip = input.percentualLip;
  let percentualCho = input.percentualCho;

  if (percentualPtn === undefined) {
    let gKgPtnBase = input.gKgPtn;
    if (gKgPtnBase === undefined) {
      if (objetivo === 'emagrecimento') gKgPtnBase = 1.8;
      else if (objetivo === 'hipertrofia') gKgPtnBase = 2.0;
      else if (idade >= 60) gKgPtnBase = 1.2;
      else if (isDoencaCronica || isPosCirurgico) gKgPtnBase = 1.5;
      else gKgPtnBase = 1.4;
    }
    if (idade >= 60 && gKgPtnBase < 1.2) gKgPtnBase = 1.2;

    const ptnKcalBase = (gKgPtnBase * pesoUtilizado) * 4;
    percentualPtn = (ptnKcalBase / getAjustado) * 100;
  }

  if (percentualLip === undefined) percentualLip = 25;
  if (percentualCho === undefined) percentualCho = 100 - percentualPtn - percentualLip;

  const totalPercent = percentualPtn + percentualLip + percentualCho;
  if (Math.abs(totalPercent - 100) > 0.1 && input.percentualCho !== undefined) {
    alertas.push('Atenção: A soma dos macronutrientes é diferente de 100%.');
  }

  const ptnKcal = getAjustado * (percentualPtn / 100);
  const ptnG = ptnKcal / 4;
  const gKgPtn = ptnG / pesoUtilizado;

  const lipKcal = getAjustado * (percentualLip / 100);
  const lipG = lipKcal / 9;

  const choKcal = getAjustado * (percentualCho / 100);
  const choG = choKcal / 4;

  if (choG < 100) alertas.push('Atenção: Carboidratos abaixo de 100g/dia.');

  return {
    ptnKcal, ptnG, ptnGKg: gKgPtn, ptnPercentual: percentualPtn,
    choKcal, choG, choGKg: choG / pesoUtilizado, choPercentual: percentualCho,
    lipKcal, lipG, lipPercentual: percentualLip,
    alertas,
  };
}
