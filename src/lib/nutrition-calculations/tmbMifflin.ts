import type { Sexo } from './types';

// Mifflin-St Jeor (1990). Verificado nesta auditoria — coeficientes exatos, sem alteração.
export function calcularMifflin(pesoKg: number, alturaCm: number, idade: number, sexo: Sexo): number {
  return sexo === 'masculino'
    ? (10 * pesoKg) + (6.25 * alturaCm) - (5 * idade) + 5
    : (10 * pesoKg) + (6.25 * alturaCm) - (5 * idade) - 161;
}
