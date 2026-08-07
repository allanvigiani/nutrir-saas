import { describe, it, expect } from 'vitest';
import { NIVEL_ATIVIDADE_ADULTO, NIVEL_ATIVIDADE_PEDIATRICO } from '../../../lib/nutrition-calculations/nivelAtividade.ts';

describe('tabelas de nível de atividade', () => {
  it('expõe os 4 níveis adultos (sedentário a intenso)', () => {
    expect(NIVEL_ATIVIDADE_ADULTO).toEqual(['1.2', '1.375', '1.55', '1.725']);
  });
  it('expõe os 5 níveis pediátricos (repouso a muito ativo)', () => {
    expect(NIVEL_ATIVIDADE_PEDIATRICO).toEqual(['1.20', '1.40', '1.55', '1.75', '2.00']);
  });
});
