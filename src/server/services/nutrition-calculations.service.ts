import { getDb } from '../lib/rls-context.ts';

function toSnakeCase(calc: any) {
  return {
    id: calc.id,
    patient_id: calc.patientId,
    consultation_id: calc.consultationId ?? null,
    nutritionist_id: calc.nutritionistId,
    name: calc.name,
    input: calc.input,
    result: calc.result,
    createdAt: calc.createdAt,
  };
}

export function createNutritionCalculationsService() {
  async function list(nutritionistId: string, patientId: string) {
    const rows = await getDb().nutritionCalculation.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSnakeCase);
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    const calc = await getDb().nutritionCalculation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
    return toSnakeCase(calc);
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().nutritionCalculation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    const calc = await getDb().nutritionCalculation.update({
      where: { id },
      data: { input: data.input as any, result: data.result as any },
    });
    return toSnakeCase(calc);
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().nutritionCalculation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().nutritionCalculation.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
