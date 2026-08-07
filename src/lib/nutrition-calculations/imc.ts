export function calculateImc(pesoKg: number, alturaM: number): number {
  return pesoKg / (alturaM * alturaM);
}

export type ClassificacaoImc =
  | 'Baixo peso'
  | 'Eutrófico'
  | 'Sobrepeso'
  | 'Obesidade grau I'
  | 'Obesidade grau II'
  | 'Obesidade grau III (mórbida)';

export function classifyImc(imc: number): ClassificacaoImc {
  if (imc < 18.5) return 'Baixo peso';
  if (imc < 25) return 'Eutrófico';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau I';
  if (imc < 40) return 'Obesidade grau II';
  return 'Obesidade grau III (mórbida)';
}

export function idealWeightRangeByBmi(alturaM: number): { min: number; max: number } {
  return {
    min: Math.round(18.5 * alturaM * alturaM * 10) / 10,
    max: Math.round(24.9 * alturaM * alturaM * 10) / 10,
  };
}
