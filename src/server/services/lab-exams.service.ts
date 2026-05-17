import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createLabExamsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().labExam.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const examCount = await getDb().labExam.count({ where: { patientId, nutritionistId, deletedAt: null } });
      if (examCount >= FREE_PLAN_LIMITS.maxExams) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxExams} exame por paciente atingido no plano gratuito.`);
      }
    }
    return getDb().labExam.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().labExam.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().labExam.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().labExam.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().labExam.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
