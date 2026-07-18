export type FaixaEtaria = 'Criança/Adolescente' | 'Adulto' | 'Idoso';

export function classifyFaixaEtaria(idade: number): FaixaEtaria {
  if (idade < 18) return 'Criança/Adolescente';
  if (idade <= 59) return 'Adulto';
  return 'Idoso';
}
