import type { Sexo } from './types';

// Harris-Benedict revisada (Roza & Shizgal, 1984). Verificado nesta auditoria —
// coeficientes exatos, sem alteração.
export function calcularHarrisBenedict(pesoKg: number, alturaCm: number, idade: number, sexo: Sexo): number {
  return sexo === 'masculino'
    ? 88.362 + (13.397 * pesoKg) + (4.799 * alturaCm) - (5.677 * idade)
    : 447.593 + (9.247 * pesoKg) + (3.098 * alturaCm) - (4.330 * idade);
}
