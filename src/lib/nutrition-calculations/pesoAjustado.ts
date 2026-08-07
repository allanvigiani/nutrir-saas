// Peso ajustado para obesidade (IBW + 25% do excesso sobre o peso ideal), padrão
// ASPEN para pacientes com peso atual significativamente acima do ideal. Peso ideal
// aqui usa IMC de referência 22 (convenção já usada neste projeto desde a v1 da
// calculadora), aplicado apenas a adultos (idade >= 18) com IMC >= 30.
export interface PesoAjustadoResult {
  pesoUtilizado: number;
  justificativaPeso: string;
}

export function calcularPesoAjustado(
  pesoKg: number,
  alturaM: number,
  imc: number,
  idade: number,
): PesoAjustadoResult {
  if (imc >= 30 && idade >= 18) {
    const pesoIdeal = 22 * (alturaM * alturaM);
    const pesoUtilizado = pesoIdeal + 0.25 * (pesoKg - pesoIdeal);
    return {
      pesoUtilizado,
      justificativaPeso: `Peso ajustado (IMC >= 30): Ideal (${Math.round(pesoIdeal)}kg) + 25% do excesso`,
    };
  }
  return { pesoUtilizado: pesoKg, justificativaPeso: 'Peso atual (IMC < 30)' };
}
