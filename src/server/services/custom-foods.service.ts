import { getDb } from '../lib/rls-context.ts';

type CreateFoodInput = {
  name: string; kcal: number; protein: number; carbs: number;
  fat: number; baseUnit: string; baseQuantity: number; serving?: unknown;
};

export function createCustomFoodsService() {
  async function list(nutritionistId: string) {
    return getDb().customFood.findMany({ where: { nutritionistId, deletedAt: null } });
  }

  async function create(nutritionistId: string, data: CreateFoodInput) {
    const { serving, ...rest } = data;
    return getDb().customFood.create({
      data: {
        ...rest,
        nutritionistId,
        ...(serving !== undefined ? { serving: serving as any } : {}),
      },
    });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreateFoodInput>) {
    const existing = await getDb().customFood.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    const { serving, ...rest } = data;
    return getDb().customFood.update({
      where: { id },
      data: {
        ...rest,
        ...(serving !== undefined ? { serving: serving as any } : {}),
      },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().customFood.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().customFood.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
