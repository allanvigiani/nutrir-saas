import { getDb } from '../lib/rls-context.ts';

export function createNutritionCalculationsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().nutritionCalculation.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return getDb().nutritionCalculation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().nutritionCalculation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().nutritionCalculation.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, remove };
}
