import { getDb } from '../lib/rls-context.ts';

export const NUTRITIONIST_NOT_FOUND = 'Nutricionista não encontrado';

export function createNutritionistsService() {
  async function getMe(uid: string) {
    const nutritionist = await getDb().nutritionist.findUnique({
      where: { id: uid },
      include: { subscription: true },
    });
    if (!nutritionist) throw new Error(NUTRITIONIST_NOT_FOUND);
    if (process.env.FREE_TRIAL_MODE === 'true') {
      return { ...nutritionist, freeTrialMode: true };
    }
    return nutritionist;
  }

  async function updateMe(uid: string, data: Record<string, unknown>) {
    const existing = await getDb().nutritionist.findUnique({ where: { id: uid }, select: { id: true } });
    if (!existing) throw new Error('Nutricionista não encontrado');
    return getDb().nutritionist.update({
      where: { id: uid },
      data: { ...data, updatedAt: new Date() },
    });
  }

  return { getMe, updateMe };
}
