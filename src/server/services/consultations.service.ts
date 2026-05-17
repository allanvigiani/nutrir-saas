import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createConsultationsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().consultation.findMany({
      where: { patientId, nutritionistId },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const [totalThisMonth, patientThisMonth] = await Promise.all([
        getDb().consultation.count({
          where: { nutritionistId, date: { gte: startOfMonth, lte: endOfMonth } },
        }),
        getDb().consultation.count({
          where: { nutritionistId, patientId, date: { gte: startOfMonth, lte: endOfMonth } },
        }),
      ]);

      if (totalThisMonth >= FREE_PLAN_LIMITS.maxConsultationsPerMonth) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxConsultationsPerMonth} consultas mensais atingido no plano gratuito.`);
      }
      if (patientThisMonth >= FREE_PLAN_LIMITS.maxConsultationsPerPatientPerMonth) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxConsultationsPerPatientPerMonth} consulta por paciente por mês atingido no plano gratuito.`);
      }
    }
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
