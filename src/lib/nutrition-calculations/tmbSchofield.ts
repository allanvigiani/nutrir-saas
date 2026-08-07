import type { Sexo } from './types';
import { calcularOms } from './tmbOms';

export interface SchofieldResult {
  tmb: number;
  alertas: string[];
}

export function calcularSchofield(pesoKg: number, alturaM: number, idade: number, sexo: Sexo): SchofieldResult {
  if (idade <= 18) {
    // CORRIGIDO em 2026-07-18: a variante peso+altura pediátrica anterior reaproveitava
    // por engano a constante da tabela peso-only (FAO/WHO/UNU Table 5.2) como se fosse
    // um coeficiente de altura, produzindo TMB muito acima do esperado (erro crescente
    // com a altura). Nenhuma fonte confiável de uma equação peso+altura pediátrica real
    // foi encontrada nesta auditoria — até que uma seja localizada, este ramo usa a
    // equação peso-only corrigida (idêntica a "oms" nesta faixa etária). Ver
    // docs/superpowers/specs/2026-07-18-relatorio-auditoria-calculos.md.
    return {
      tmb: calcularOms(pesoKg, idade, sexo),
      alertas: [
        'Schofield para menores de 18 anos: a variante peso+altura não pôde ser verificada contra fonte confiável; usando a equação peso-only (FAO/WHO/UNU 1985), idêntica a "oms" nesta faixa etária.',
      ],
    };
  }

  // Schofield 1985 (peso + altura), adultos 19+. Coeficientes de fonte secundária
  // (ver docs/superpowers/specs/2026-06-30-calculo-nutricional-design.md). Pesquisa
  // adicional em 2026-07-18 encontrou uma segunda fonte (nafwa.org) com coeficiente de
  // altura substancialmente diferente para a mesma faixa etária (ex.: homens 18-30,
  // ~-10/m nessa fonte vs -27.008/m aqui) — sem acesso à publicação original (Schofield
  // WN, 1985, Human Nutrition: Clinical Nutrition 39 Suppl 1, indisponível gratuitamente)
  // para desempate. Mantido sem alteração numérica: nenhuma das duas fontes secundárias
  // é confiável o suficiente para substituir a outra.
  const alertas = [
    'Schofield adulto (peso+altura): coeficientes não puderam ser verificados contra a publicação original; fontes secundárias divergem entre si. Use com cautela.',
  ];
  let tmb: number;
  if (sexo === 'masculino') {
    if (idade <= 30) tmb = (15.296 * pesoKg) - (27.008 * alturaM) + 717.017;
    else if (idade <= 60) tmb = (11.233 * pesoKg) + (16.013 * alturaM) + 900.813;
    else tmb = (8.843 * pesoKg) + (1128.107 * alturaM) - 1070.985;
  } else {
    if (idade <= 30) tmb = (13.384 * pesoKg) + (333.891 * alturaM) + 34.895;
    else if (idade <= 60) tmb = (8.604 * pesoKg) - (25.096 * alturaM) + 864.962;
    else tmb = (9.082 * pesoKg) + (636.950 * alturaM) - 302.103;
  }
  return { tmb, alertas };
}
