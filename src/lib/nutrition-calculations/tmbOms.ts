import type { Sexo } from './types';

// FAO/WHO/UNU (1985), equações peso-only (Schofield, 1985). Coeficientes extraídos
// da fonte primária: FAO, Human energy requirements (2004), Table 5.2, coluna
// "BMR: kcal/day" — https://www.fao.org/4/y5686e/y5686e07.htm ("Source: Schofield,
// 1985"). CORRIGIDO em 2026-07-18: os coeficientes anteriores divergiam desta fonte
// primária em praticamente todas as faixas (ex.: homens >60 anos, constante 487 em
// vez de 587.7) — ver docs/superpowers/specs/2026-07-18-relatorio-auditoria-calculos.md.
export function calcularOms(pesoKg: number, idade: number, sexo: Sexo): number {
  if (sexo === 'masculino') {
    if (idade <= 3) return (59.512 * pesoKg) - 30.4;
    if (idade <= 10) return (22.706 * pesoKg) + 504.3;
    if (idade <= 18) return (17.686 * pesoKg) + 658.2;
    if (idade <= 30) return (15.057 * pesoKg) + 692.2;
    if (idade <= 60) return (11.472 * pesoKg) + 873.1;
    return (11.711 * pesoKg) + 587.7;
  }
  if (idade <= 3) return (58.317 * pesoKg) - 31.1;
  if (idade <= 10) return (20.315 * pesoKg) + 485.9;
  if (idade <= 18) return (13.384 * pesoKg) + 692.6;
  if (idade <= 30) return (14.818 * pesoKg) + 486.6;
  if (idade <= 60) return (8.126 * pesoKg) + 845.6;
  return (9.082 * pesoKg) + 658.5;
}
