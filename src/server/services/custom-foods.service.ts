import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

type CreateFoodInput = {
  name: string; kcal: number; protein: number; carbs: number;
  fat: number; baseUnit: string; baseQuantity: number; serving?: unknown;
};

export function createCustomFoodsService({ prisma }: Deps) {
  async function list(nutritionistId: string) {
    return prisma.customFood.findMany({ where: { nutritionistId } });
  }

  async function create(nutritionistId: string, data: CreateFoodInput) {
    const { serving, ...rest } = data;
    return prisma.customFood.create({
      data: {
        ...rest,
        nutritionistId,
        ...(serving !== undefined ? { serving: serving as any } : {}),
      },
    });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreateFoodInput>) {
    const existing = await prisma.customFood.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    const { serving, ...rest } = data;
    return prisma.customFood.update({
      where: { id },
      data: {
        ...rest,
        ...(serving !== undefined ? { serving: serving as any } : {}),
      },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.customFood.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.customFood.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
