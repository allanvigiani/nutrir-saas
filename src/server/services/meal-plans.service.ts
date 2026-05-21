import { getDb } from '../lib/rls-context.ts';
import { prisma } from '../lib/prisma.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createMealPlansService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().mealPlan.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const plan = await getDb().mealPlan.findFirst({
      where: { id, nutritionistId, deletedAt: null },
      include: { items: true },
    });
    if (!plan) throw new Error('Plano não encontrado');
    return plan;
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const activeCount = await getDb().mealPlan.count({
        where: { patientId, nutritionistId, status: 'active', deletedAt: null },
      });
      if (activeCount >= FREE_PLAN_LIMITS.maxMealPlans) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxMealPlans} plano alimentar ativo por paciente atingido no plano gratuito.`);
      }
    }
    return getDb().mealPlan.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    const { items, ...planData } = data as any;
    return getDb().mealPlan.update({ where: { id }, data: planData });
  }

  // Substituição atômica de itens (operação interna — meal_plan_items usa hard delete intencional)
  async function replaceItems(nutritionistId: string, id: string, items: Record<string, unknown>[]) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.$transaction([
      prisma.mealPlanItem.deleteMany({ where: { mealPlanId: id } }),
      ...items.map(item =>
        prisma.mealPlanItem.create({
          data: { ...(item as any), mealPlanId: id, nutritionistId },
        })
      ),
    ]);
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().mealPlan.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Items — meal_plan_items usa hard delete intencional (sem deletedAt na tabela)
  async function listItems(nutritionistId: string, mealPlanId: string) {
    const plan = await getDb().mealPlan.findFirst({ where: { id: mealPlanId, nutritionistId, deletedAt: null } });
    if (!plan) throw new Error('Não autorizado');
    return getDb().mealPlanItem.findMany({ where: { mealPlanId } });
  }

  async function createItem(nutritionistId: string, mealPlanId: string, data: Record<string, unknown>) {
    const plan = await getDb().mealPlan.findFirst({ where: { id: mealPlanId, nutritionistId, deletedAt: null } });
    if (!plan) throw new Error('Não autorizado');
    return getDb().mealPlanItem.create({ data: { ...(data as any), mealPlanId, nutritionistId } });
  }

  async function updateItem(nutritionistId: string, itemId: string, data: Record<string, unknown>) {
    const existing = await getDb().mealPlanItem.findFirst({ where: { id: itemId, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().mealPlanItem.update({ where: { id: itemId }, data: data as any });
  }

  async function removeItem(nutritionistId: string, itemId: string) {
    const existing = await getDb().mealPlanItem.findFirst({ where: { id: itemId, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().mealPlanItem.delete({ where: { id: itemId } });
  }

  return { list, getOne, create, update, remove, listItems, createItem, updateItem, removeItem, replaceItems };
}
