import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';
import { subMonths } from 'date-fns';

export function createConsultationsService() {
  async function list(nutritionistId: string, patientId: string, isPremium: boolean) {
    const baseWhere = { patientId, nutritionistId, deletedAt: null };
    if (isPremium) {
      const items = await getDb().consultation.findMany({ where: baseWhere, orderBy: { date: 'desc' } });
      return { items, hasHiddenHistory: false };
    }

    // Plano gratuito só vê os últimos FREE_PLAN_LIMITS.historyMonths meses —
    // filtro precisa ser no backend, não só na UI, senão dá pra ver tudo via API direta.
    const historyLimitDate = subMonths(new Date(), FREE_PLAN_LIMITS.historyMonths).toISOString().split('T')[0];
    const [items, totalCount] = await Promise.all([
      getDb().consultation.findMany({ where: { ...baseWhere, date: { gt: historyLimitDate } }, orderBy: { date: 'desc' } }),
      getDb().consultation.count({ where: baseWhere }),
    ]);
    return { items, hasHiddenHistory: totalCount > items.length };
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const [totalThisMonth, patientThisMonth] = await Promise.all([
        getDb().consultation.count({
          where: { nutritionistId, deletedAt: null, date: { gte: startOfMonth, lte: endOfMonth } },
        }),
        getDb().consultation.count({
          where: { nutritionistId, patientId, deletedAt: null, date: { gte: startOfMonth, lte: endOfMonth } },
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
    const existing = await getDb().consultation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().consultation.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().consultation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().consultation.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
