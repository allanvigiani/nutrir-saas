import type { Sexo } from './types';

type CategoriaAtividade = 'sedentario' | 'pouco_ativo' | 'ativo' | 'muito_ativo';

export interface EerInput {
  pesoKg: number;
  alturaM: number;
  idade: number;
  sexo: Sexo;
  idadeMeses?: number;
  categoriaAtividadeEER?: CategoriaAtividade;
  fatorClinicoBase: number;
}

export interface EerResult {
  tmb: number;
  get: number;
}

// EER/DRI (IOM 2005). Verificado contra NCBI Bookshelf/IOM 2005 e FAO/WHO/UNU nos
// specs 2026-06-30 e 2026-07-03 — sem alteração nesta auditoria.
const PAF_PEDIATRICO: Record<Sexo, Record<CategoriaAtividade, number>> = {
  masculino: { sedentario: 1.00, pouco_ativo: 1.13, ativo: 1.26, muito_ativo: 1.42 },
  feminino: { sedentario: 1.00, pouco_ativo: 1.16, ativo: 1.31, muito_ativo: 1.56 },
};

const PA_ADULTO: Record<Sexo, Record<CategoriaAtividade, number>> = {
  masculino: { sedentario: 1.00, pouco_ativo: 1.11, ativo: 1.25, muito_ativo: 1.48 },
  feminino: { sedentario: 1.00, pouco_ativo: 1.12, ativo: 1.27, muito_ativo: 1.45 },
};

export function calcularEer(input: EerInput): EerResult {
  const { pesoKg, alturaM, idade, sexo, idadeMeses, fatorClinicoBase } = input;
  const categoria: CategoriaAtividade = input.categoriaAtividadeEER || 'sedentario';

  if (idadeMeses !== undefined && idadeMeses >= 0 && idadeMeses <= 35) {
    let incrementoCrescimento: number;
    if (idadeMeses <= 3) incrementoCrescimento = 175;
    else if (idadeMeses <= 6) incrementoCrescimento = 56;
    else if (idadeMeses <= 12) incrementoCrescimento = 22;
    else incrementoCrescimento = 20;

    const tmb = (89 * pesoKg) - 100 + incrementoCrescimento;
    return { tmb, get: tmb * fatorClinicoBase };
  }

  if (idade >= 3 && idade <= 18) {
    const paf = PAF_PEDIATRICO[sexo][categoria];
    if (sexo === 'masculino') {
      const base = 88.5 - (61.9 * idade);
      const incremento = (26.7 * pesoKg) + (903 * alturaM);
      const tmb = base + incremento + 20;
      return { tmb, get: (base + paf * incremento + 20) * fatorClinicoBase };
    }
    const base = 135.3 - (30.8 * idade);
    const incremento = (10.0 * pesoKg) + (934 * alturaM);
    const tmb = base + incremento + 20;
    return { tmb, get: (base + paf * incremento + 20) * fatorClinicoBase };
  }

  if (idade >= 19) {
    const pa = PA_ADULTO[sexo][categoria];
    if (sexo === 'masculino') {
      const base = 662 - (9.53 * idade);
      const incremento = (15.91 * pesoKg) + (539.6 * alturaM);
      const tmb = base + incremento;
      return { tmb, get: (base + pa * incremento) * fatorClinicoBase };
    }
    const base = 354 - (6.91 * idade);
    const incremento = (9.36 * pesoKg) + (726 * alturaM);
    const tmb = base + incremento;
    return { tmb, get: (base + pa * incremento) * fatorClinicoBase };
  }

  // idade < 3 sem idadeMeses válido: nenhuma equação disponível (o controller
  // bloqueia esse caso antes de chegar aqui — ver nutrition.controller.ts).
  return { tmb: 0, get: 0 };
}
