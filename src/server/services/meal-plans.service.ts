import { getDb } from '../lib/rls-context.ts';
import { prisma } from '../lib/prisma.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

function itemToSnakeCase(item: any) {
  return {
    id: item.id,
    meal_plan_id: item.mealPlanId,
    nutritionist_id: item.nutritionistId,
    meal: item.meal,
    food: item.food,
    quantity: item.quantity,
    unit: item.unit,
    kcal: item.kcal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    base_kcal: item.baseKcal,
    base_protein: item.baseProtein,
    base_carbs: item.baseCarbs,
    base_fat: item.baseFat,
    base_quantity: item.baseQuantity,
    serving_name: item.servingName,
    serving_weight: item.servingWeight,
    position: item.position ?? 0,
  };
}

function toSnakeCase(plan: any) {
  const { consultationId, calculationId, patientId, nutritionistId, items, ...rest } = plan;
  return {
    ...rest,
    patient_id: patientId,
    nutritionist_id: nutritionistId,
    ...(consultationId !== undefined ? { consultation_id: consultationId } : {}),
    ...(calculationId !== undefined ? { calculation_id: calculationId } : {}),
    ...(items !== undefined ? { items: items.map(itemToSnakeCase) } : {}),
  };
}

export function createMealPlansService() {
  async function list(nutritionistId: string, patientId: string) {
    const plans = await getDb().mealPlan.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return plans.map(toSnakeCase);
  }

  async function getOne(nutritionistId: string, id: string) {
    const plan = await getDb().mealPlan.findFirst({
      where: { id, nutritionistId, deletedAt: null },
      include: { items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
    });
    if (!plan) throw new Error('Plano não encontrado');
    return toSnakeCase(plan);
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
    const { consultation_id, calculation_id, items, ...rest } = data as any;
    return getDb().mealPlan.create({
      data: {
        ...rest,
        patientId,
        nutritionistId,
        ...(consultation_id ? { consultationId: consultation_id } : {}),
        ...(calculation_id ? { calculationId: calculation_id } : {}),
      },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    const { items, consultation_id, calculation_id, ...rest } = data as any;
    return getDb().mealPlan.update({
      where: { id },
      data: {
        ...rest,
        ...(consultation_id !== undefined ? { consultationId: consultation_id } : {}),
        ...(calculation_id !== undefined ? { calculationId: calculation_id } : {}),
      },
    });
  }

  function mapItem(item: any, mealPlanId: string, nutritionistId: string) {
    return {
      mealPlanId,
      nutritionistId,
      meal: item.meal,
      food: item.food,
      quantity: item.quantity,
      unit: item.unit,
      kcal: item.kcal ?? null,
      protein: item.protein ?? null,
      carbs: item.carbs ?? null,
      fat: item.fat ?? null,
      baseKcal: item.base_kcal ?? null,
      baseProtein: item.base_protein ?? null,
      baseCarbs: item.base_carbs ?? null,
      baseFat: item.base_fat ?? null,
      baseQuantity: item.base_quantity ?? null,
      servingName: item.serving_name ?? null,
      servingWeight: item.serving_weight ?? null,
      position: item.position ?? 0,
    };
  }

  // Substituição atômica de itens (operação interna — meal_plan_items usa hard delete intencional)
  async function replaceItems(nutritionistId: string, id: string, items: Record<string, unknown>[]) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.$transaction([
      prisma.mealPlanItem.deleteMany({ where: { mealPlanId: id } }),
      ...items.map(item =>
        prisma.mealPlanItem.create({
          data: mapItem(item, id, nutritionistId),
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
    return getDb().mealPlanItem.findMany({
      where: { mealPlanId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
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
