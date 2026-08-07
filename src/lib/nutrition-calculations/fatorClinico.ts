// Multiplicadores de fator de estresse clínico. Valores de julgamento clínico —
// fora do escopo de correção desta auditoria (ver docs/superpowers/specs/
// 2026-07-18-relatorio-auditoria-calculos.md, seção "não alterado").
export interface FatorClinicoInput {
  fatorClinicoValor?: number;
  condicoesClinicas: string[];
}

export function calcularFatorClinico({ fatorClinicoValor, condicoesClinicas }: FatorClinicoInput): number {
  if (fatorClinicoValor) return fatorClinicoValor;

  const isSepseUti = condicoesClinicas.some((c) => ['sepse', 'critico'].includes(c));
  if (isSepseUti) return 1.5;
  if (condicoesClinicas.includes('trauma')) return 1.3;
  if (condicoesClinicas.includes('pos_cirurgico')) return 1.2;
  if (condicoesClinicas.includes('infeccao')) return 1.2;
  if (condicoesClinicas.includes('doenca_cronica')) return 1.2;
  if (condicoesClinicas.includes('inflamacao')) return 1.1;
  return 1.0;
}
