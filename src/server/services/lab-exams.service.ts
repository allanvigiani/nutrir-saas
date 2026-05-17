import { getDb } from '../lib/rls-context.ts';

export function createLabExamsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().labExam.findMany({
      where: { patientId, nutritionistId },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return getDb().labExam.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().labExam.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().labExam.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().labExam.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().labExam.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
