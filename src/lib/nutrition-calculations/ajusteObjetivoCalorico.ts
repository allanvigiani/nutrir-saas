export type Objetivo = 'emagrecimento' | 'manutencao' | 'hipertrofia' | 'reabilitacao';

export interface AjusteObjetivoResult {
  ajusteCalorico: number;
  alertas: string[];
}

// Magnitudes de déficit/superávit padrão são valores de julgamento clínico — fora do
// escopo de correção desta auditoria (ver relatório, seção "não alterado"). O
// tratamento de ajusteObjetivoValor como magnitude (>=0), com sinal decidido aqui
// internamente, é a correção do bug histórico documentada em
// docs/superpowers/specs/2026-06-30-calculo-nutricional-design.md.
export function calcularAjusteObjetivo(
  objetivo: Objetivo,
  ajusteObjetivoValor: number | undefined,
  isInflamado: boolean,
  fatorClinicoBase: number,
): AjusteObjetivoResult {
  let ajusteCalorico = 0;
  if (ajusteObjetivoValor !== undefined) {
    const magnitude = Math.abs(ajusteObjetivoValor);
    if (objetivo === 'emagrecimento') ajusteCalorico = -magnitude;
    else if (objetivo === 'hipertrofia') ajusteCalorico = magnitude;
    else ajusteCalorico = ajusteObjetivoValor;
  } else {
    if (objetivo === 'emagrecimento') ajusteCalorico = -400;
    else if (objetivo === 'hipertrofia') ajusteCalorico = 400;
    else if (objetivo === 'reabilitacao') ajusteCalorico = 300;
  }

  const alertas: string[] = [];
  if (isInflamado && fatorClinicoBase >= 1.2 && objetivo === 'hipertrofia' && ajusteCalorico > 300) {
    alertas.push('Evitar superávit calórico elevado em pacientes com inflamação ativa. Ajuste limitado a +300 kcal.');
    ajusteCalorico = 300;
  } else if (isInflamado) {
    alertas.push('Evitar superávit calórico elevado em pacientes com inflamação ativa.');
  }

  return { ajusteCalorico, alertas };
}

// Bônus calórico de gestação, confirmado contra IOM/DRI no spec de 2026-06-30
// (+340 kcal 2º trimestre, +450 kcal 3º trimestre; sem incremento no 1º trimestre).
export function calcularBonusGestacao(trimestre: 1 | 2 | 3 | undefined): { bonus: number; alerta: string | null } {
  if (trimestre === 2) return { bonus: 340, alerta: 'Gestante (2º Tri) — calorias adicionais aplicadas (+340 kcal)' };
  if (trimestre === 3) return { bonus: 450, alerta: 'Gestante (3º Tri) — calorias adicionais aplicadas (+450 kcal)' };
  return { bonus: 0, alerta: null };
}
