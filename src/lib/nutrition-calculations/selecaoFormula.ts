export type FormulaTmb = 'mifflin' | 'harris' | 'oms' | 'kcal_kg' | 'schofield' | 'eer';

export function sugerirFormula(idade: number, condicoesClinicas: string[]): FormulaTmb {
  const hasHospitalar = condicoesClinicas.some((c) =>
    ['internado', 'critico', 'pos_cirurgico'].includes(c),
  );
  if (hasHospitalar) return 'kcal_kg';
  if (idade < 18 || idade >= 60) return 'oms';
  return 'mifflin';
}
