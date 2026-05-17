import { getDb } from '../lib/rls-context.ts';

export function createConsultationsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().consultation.findMany({
      where: { patientId, nutritionistId },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return getDb().consultation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().consultation.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().consultation.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().consultation.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().consultation.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
