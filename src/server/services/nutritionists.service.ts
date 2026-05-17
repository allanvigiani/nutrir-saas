import { getDb } from '../lib/rls-context.ts';

export function createNutritionistsService() {
  async function getMe(uid: string) {
    const nutritionist = await getDb().nutritionist.findUnique({
      where: { id: uid },
      include: { subscription: true },
    });
    if (!nutritionist) throw new Error('Nutricionista não encontrado');
    return nutritionist;
  }

  async function updateMe(uid: string, data: Record<string, unknown>) {
    return getDb().nutritionist.update({
      where: { id: uid },
      data: { ...data, updatedAt: new Date() },
    });
  }

  return { getMe, updateMe };
}
