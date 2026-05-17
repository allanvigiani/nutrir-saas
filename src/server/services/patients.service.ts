import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createPatientsService() {
  async function list(nutritionistId: string) {
    return getDb().patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function create(nutritionistId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const count = await getDb().patient.count({
        where: { nutritionistId, deletedAt: null },
      });
      if (count >= FREE_PLAN_LIMITS.maxPatients) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxPatients} pacientes atingido no plano gratuito.`);
      }
    }
    return getDb().patient.create({ data: { ...(data as any), nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>, _isPremium: boolean) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, getOne, create, update, remove };
}
