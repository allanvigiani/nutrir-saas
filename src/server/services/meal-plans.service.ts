import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createMealPlansService({ prisma }: Deps) {
  async function list(nutritionistId: string, patientId: string) {
    return prisma.mealPlan.findMany({
      where: { patientId, nutritionistId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const plan = await prisma.mealPlan.findFirst({
      where: { id, nutritionistId },
      include: { items: true },
    });
    if (!plan) throw new Error('Plano não encontrado');
    return plan;
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return prisma.mealPlan.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await prisma.mealPlan.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    const { items, ...planData } = data as any;
    return prisma.mealPlan.update({ where: { id }, data: planData });
  }

  // Replaces all items of a meal plan atomically (delete old + insert new)
  async function replaceItems(nutritionistId: string, id: string, items: Record<string, unknown>[]) {
    const existing = await prisma.mealPlan.findFirst({ where: { id, nutritionistId } });
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
    const existing = await prisma.mealPlan.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.mealPlan.delete({ where: { id } });
  }

  // Items
  async function listItems(nutritionistId: string, mealPlanId: string) {
    const plan = await prisma.mealPlan.findFirst({ where: { id: mealPlanId, nutritionistId } });
    if (!plan) throw new Error('Não autorizado');
    return prisma.mealPlanItem.findMany({ where: { mealPlanId } });
  }

  async function createItem(nutritionistId: string, mealPlanId: string, data: Record<string, unknown>) {
    const plan = await prisma.mealPlan.findFirst({ where: { id: mealPlanId, nutritionistId } });
    if (!plan) throw new Error('Não autorizado');
    return prisma.mealPlanItem.create({ data: { ...(data as any), mealPlanId, nutritionistId } });
  }

  async function updateItem(nutritionistId: string, itemId: string, data: Record<string, unknown>) {
    const existing = await prisma.mealPlanItem.findFirst({ where: { id: itemId, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.mealPlanItem.update({ where: { id: itemId }, data: data as any });
  }

  async function removeItem(nutritionistId: string, itemId: string) {
    const existing = await prisma.mealPlanItem.findFirst({ where: { id: itemId, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.mealPlanItem.delete({ where: { id: itemId } });
  }

  return { list, getOne, create, update, remove, listItems, createItem, updateItem, removeItem, replaceItems };
}
