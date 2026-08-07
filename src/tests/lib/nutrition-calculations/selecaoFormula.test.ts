import { describe, it, expect } from 'vitest';
import { sugerirFormula } from '../../../lib/nutrition-calculations/selecaoFormula.ts';

describe('sugerirFormula', () => {
  it('sugere mifflin para adultos saudáveis', () => {
    expect(sugerirFormula(30, [])).toBe('mifflin');
  });
  it('sugere oms para menores de 18 anos', () => {
    expect(sugerirFormula(15, [])).toBe('oms');
  });
  it('sugere oms para idosos (>= 60)', () => {
    expect(sugerirFormula(65, [])).toBe('oms');
  });
  it('sugere kcal_kg para pacientes internados/críticos/pós-cirúrgicos', () => {
    expect(sugerirFormula(30, ['internado'])).toBe('kcal_kg');
    expect(sugerirFormula(30, ['critico'])).toBe('kcal_kg');
    expect(sugerirFormula(30, ['pos_cirurgico'])).toBe('kcal_kg');
  });
  it('prioriza kcal_kg mesmo em paciente idoso hospitalizado', () => {
    expect(sugerirFormula(70, ['internado'])).toBe('kcal_kg');
  });
});
