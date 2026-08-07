// Fórmula simples kcal/kg, usada para pacientes hospitalizados/críticos. Default de
// 25 kcal/kg alinhado com PENG Pocket Guide to Clinical Nutrition, 5ª ed. (2018),
// que recomenda 20-25 kcal/kg BW/dia para REE em pacientes com BMI 18.5-30.
export function calcularKcalKg(
  pesoKg: number,
  kcalKgValor: number | undefined,
  fatorClinicoBase: number,
): { tmb: number; get: number } {
  const kcalKg = kcalKgValor || 25;
  const tmb = kcalKg * pesoKg;
  return { tmb, get: tmb * fatorClinicoBase };
}
